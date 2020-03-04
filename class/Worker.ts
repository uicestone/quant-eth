import Trader from "./Trader";
import Order from "./Order";
import config from "../config";
import { floor, ceil, sleep } from "../helpers";

export default class Worker {
  constructor(trader: Trader) {
    this.trader = trader;
  }
  trader: Trader;
  makeOffset = config.makeOffset;
  openOrder?: Order;
  closeOrder?: Order;

  status: "READY" | "OPEN" | "CLOSED" = "READY";

  // 返回实时利润，单位ETH
  get profit() {
    if (!this.trader.last) return;
    if (this.openOrder?.status !== "FILLED") return;
    const openPrice = this.openOrder.price;
    const closePrice =
      this.closeOrder?.status === "FILLED"
        ? this.closeOrder.price
        : this.trader.last;

    const rawProfit = floor(
      (((closePrice - openPrice) *
        this.openOrder.amount *
        config.usdPerAmount) /
        openPrice /
        closePrice) *
        (this.openOrder.direction === "BUY" ? 1 : -1),
      4
    );
    return (
      rawProfit -
      (this.openOrder.fee || 0) -
      (this.closeOrder ? this.closeOrder.fee || 0 : this.openOrder.fee || 0)
    );
  }

  async open(direction: "BUY" | "SELL", price?: number) {
    if (!price) {
      if (!this.trader.last) throw "no_price";
      if (direction === "BUY") price = this.trader.last - this.makeOffset;
      else price = this.trader.last + this.makeOffset;
    }
    const amount = this.trader.lot;
    this.openOrder = new Order(this, direction, "OPEN", price, amount);
    this.trader.orders.push(this.openOrder);
    await this.openOrder.submit();
    console.log(`OPEN order submit:`, this.openOrder.summary);
  }

  async close() {
    if (!this.openOrder) throw "no_open_order";
    if (this.openOrder.status !== "FILLED") throw "open_order_not_filled";
    const direction = this.openOrder.direction === "BUY" ? "SELL" : "BUY";
    const price =
      this.openOrder.price *
      (1 +
        (this.trader.spacing / this.trader.lever) *
          (direction === "BUY" ? -1 : 1));
    const amount = this.trader.lot;
    this.closeOrder = new Order(this, direction, "CLOSE", price, amount);
    this.trader.orders.push(this.closeOrder);
    await this.closeOrder.submit();
    console.log(`CLOSE order submit:`, this.closeOrder.summary);
  }

  notifyLast() {
    if (!this.trader.last) throw "no_price";
    if (config.mock) {
      [(this.openOrder, this.closeOrder)].forEach((o, index) => {
        if (!o) return;
        const state = o.state;
        const p = this.trader.last;
        if (!p) throw "no_price";
        if (
          o.status === "MADE" &&
          ((o.direction === "BUY" && p < o.price) ||
            (o.direction === "SELL" && p > o.price))
        ) {
          o.fee = ceil(((o.amount * config.usdPerAmount) / o.price) * 2e-4, 6);
          o.updateStatus("FILLED");
          console.log(`${state} order filled:`, o.summary);
        }
      });
    }
  }

  async orderStatusUpdated(order: Order) {
    if (order.status === "FILLED") {
      if (order.state === "OPEN") {
        this.status = "OPEN";
        await this.close();
        this.trader.requestBackup(this);
      } else {
        this.status = "CLOSED";
        this.trader.workerClosed(this);
      }
    }
  }
}
