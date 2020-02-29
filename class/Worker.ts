import Trader from "./Trader";
import Order from "./Order";
import config from "../config";

export default class Worker {
  constructor(trader: Trader) {
    this.trader = trader;
  }
  trader: Trader;
  notifyLast() {
    if (!this.trader.last) throw "no_price";
    [this.openOrder, this.closeOrder].forEach((o, index) => {
      if (!o) return;
      const state = o.state;
      const p = this.trader.last;
      if (!p) throw "no_price";
      if (
        o.status === "MADE" &&
        ((o.direction === "BUY" && p < o.price) ||
          (o.direction === "SELL" && p > o.price))
      ) {
        o.status = "FILLED";
        o.fee =
          Math.ceil(((o.amount * config.usdPerAmount) / o.price) * 2e-4 * 1e6) /
          1e6;
        console.log(`${state} order filled:`, o.summary);
        if (state === "OPEN") {
          this.status = "OPEN";
          this.close();
          this.trader.requestBackup(this);
        } else {
          this.status = "CLOSED";
        }
      }
    });
  }
  makeOffset = 0.05;
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

    const rawProfit =
      Math.floor(
        (((closePrice - openPrice) *
          this.openOrder.amount *
          config.usdPerAmount) /
          openPrice /
          closePrice) *
          (this.openOrder.direction === "BUY" ? 1 : -1) *
          1e4
      ) / 1e4;
    return (
      rawProfit -
      (this.openOrder.fee || 0) -
      (this.closeOrder ? this.closeOrder.fee || 0 : this.openOrder.fee || 0)
    );
  }

  open(direction: "BUY" | "SELL", price?: number) {
    if (!price) {
      if (!this.trader.last) throw "no_price";
      if (direction === "BUY") price = this.trader.last - this.makeOffset;
      else price = this.trader.last + this.makeOffset;
    }
    const amount = this.trader.lot;
    this.openOrder = new Order({ state: "OPEN", direction, price, amount });
    this.trader.orders.push(this.openOrder);
    console.log(`OPEN order made:`, this.openOrder.summary);
  }

  close() {
    if (!this.openOrder) throw "no_open_order";
    if (this.openOrder.status !== "FILLED") throw "open_order_not_filled";
    const direction = this.openOrder.direction === "BUY" ? "SELL" : "BUY";
    const price =
      this.openOrder.price *
      (1 +
        (this.trader.spacing / this.trader.lever) *
          (direction === "BUY" ? -1 : 1));
    const amount = this.trader.lot;
    this.closeOrder = new Order({ state: "CLOSE", direction, price, amount });
    this.trader.orders.push(this.closeOrder);
    console.log(`CLOSE order made:`, this.closeOrder.summary);
  }
}
