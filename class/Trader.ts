import moment from "moment";
import Worker from "./Worker";
import Order from "./Order";
import config, { DirectionMode } from "../config";
import { floor } from "../helpers";
import api from "../api";

export default class Trader {
  constructor(
    public directionMode: DirectionMode,
    public lever: number,
    public spacing: number,
    public lot: number,
    public fund: number
  ) {
    setInterval(() => {
      if (this.profitRate < -config.overLoss) {
        console.log(
          `Profit rate ${this.profitRate} hit loss line, close all orders.`
        );
        this.terminateAndRestart();
      }

      console.log(this.info);
    }, 6e4); // 每60秒输出持仓信息
  }

  last?: number;
  boll?: { upper: number; mid: number; lower: number };

  /**
   * time of last trade start,
   * useful in BOLL_HL mode when we need a minimal open interval
   */
  startedAt?: Date;

  maxOpenWorkers = config.maxOpenWorkers;
  workers: Worker[] = [];
  orders: Order[] = [];

  updateLast(price: number) {
    // console.log("updateLast:", price);
    this.last = price;
    for (const w of this.workers) {
      w.notifyLast();
    }
    if (
      this.boll &&
      this.workers.length === 0 &&
      this.directionMode === DirectionMode.BOLL
    ) {
      if (this.last / this.boll.mid < 1 - config.spacing / config.lever) {
        console.log("BOLL is high, start buy.");
        this.start("BUY");
      } else if (
        this.last / this.boll.mid >
        1 + config.spacing / config.lever
      ) {
        console.log("BOLL is low, start sell.");
        this.start("SELL");
      }
    }
    if (
      this.boll &&
      this.workers.filter(w => w.status === "OPEN").length <
        this.maxOpenWorkers &&
      this.directionMode === DirectionMode.BOLL_HL &&
      // start BOLL_HL at minimal interval of 75 minutes (5 candles)
      (!this.startedAt ||
        moment().diff(this.startedAt, "minutes", true) >= 5 * 15)
    ) {
      if (this.last > this.boll.upper) {
        console.log("Price upper BOLL, start sell.");
        this.start("SELL");
      } else if (this.last < this.boll.lower) {
        console.log("Price lower BOLL, start buy.");
        this.start("BUY");
      }
    }
  }

  updateBoll(boll: { upper: number[]; mid: number[]; lower: number[] }) {
    this.boll = {
      upper: boll.upper[boll.upper.length - 1],
      mid: boll.mid[boll.mid.length - 1],
      lower: boll.lower[boll.lower.length - 1]
    };
    if (this.last) {
      // console.log(`LAST/BOLL: ${this.last}/${this.boll.mid.toFixed(4)}`);
    }
  }

  // 挂单信息更新
  updateOrders(
    orders: {
      client_oid: string;
      contract_val: string;
      error_code: string;
      fee: string;
      filled_qty: string;
      instrument_id: string;
      last_fill_px: string;
      last_fill_qty: string;
      last_fill_time: string;
      order_id: string;
      order_type: string;
      price: string;
      price_avg: string;
      size: string;
      state: string;
      status: string;
      timestamp: string;
      type: string;
    }[]
  ) {
    for (const o of orders) {
      if (!o.client_oid) {
        console.log("Order is not made from quant, skipping updating.");
        continue;
      }
      const order = this.orders.find(i => i.id === o.client_oid);
      if (!order) {
        console.log(`Order ${o.client_oid} not found under this trader.`);
        continue;
      }
      if (+o.filled_qty > 0) {
        if (+o.filled_qty < +o.size) {
          order.updateStatus("PARTLY_FILLED");
          console.log(
            `${order.state} order partly filled: ${order.summary}/${o.filled_qty}`
          );
        } else {
          console.log(
            `${order.state} order filled: ${order.summary}/${o.filled_qty}`
          );
          order.updateStatus("FILLED");
          order.fee = +o.fee;
        }
      }
    }
  }

  // 持仓信息更新
  updatePosition(
    position: [
      {
        holding: [
          {
            avail_position: string;
            avg_cost: string;
            last: string;
            leverage: string;
            liquidation_price: string;
            maint_margin_ratio: string;
            margin: string;
            position: string;
            realized_pnl: string;
            settled_pnl: string;
            settlement_price: string;
            side: string;
            timestamp: string;
          }
        ];
        instrument_id: "ETH-USD-SWAP";
        margin_mode: "crossed";
        timestamp: "2020-03-03T09:50:34.862Z";
      }
    ]
  ) {
    if (!position[0].holding[0]) {
      return;
    }
    const p = position[0].holding[0];
    console.log(
      `Position: ${p.avg_cost}x${p.side === "long" ? "-" : ""}${
        p.avail_position
      }@/${p.avail_position} ${p.liquidation_price}/${p.last} ${
        p.realized_pnl
      }.`
    );
  }

  workerClosed(worker: Worker) {
    const openWorkers = this.workers.filter(w => w.status === "OPEN");
    if (openWorkers.length === 0) {
      this.terminateAndRestart();
    }
  }

  start(direction?: "BUY" | "SELL", price?: number) {
    if (!direction) {
      if (this.directionMode === DirectionMode.BUY) {
        direction = "BUY";
      } else if (this.directionMode === DirectionMode.SELL) {
        direction = "SELL";
      } else if (this.directionMode === DirectionMode.RANDOM) {
        direction = Math.random() > 0.5 ? "BUY" : "SELL";
      } else {
        throw `Direction mode ${this.directionMode} not supported.`;
      }
    }
    console.log(
      `Start trade: ${direction === "SELL" ? "-" : ""}${this.lot}x${
        this.lever
      }@${this.spacing}`
    );
    const w = new Worker(this);
    w.open(direction);
    this.workers.push(w);
    this.startedAt = new Date();
  }

  requestBackup(worker: Worker) {
    if (this.directionMode === DirectionMode.BOLL_HL) {
      // We don't request backup in BOLL_HL mode.
      return;
    }
    const backupWorker = new Worker(this);
    if (!worker.openOrder) throw "no_open_order";
    backupWorker.open(
      worker.openOrder.direction,
      worker.openOrder.price *
        (1 +
          (this.spacing / this.lever) *
            (worker.openOrder.direction === "BUY" ? -1 : 1))
    );
    this.workers.push(backupWorker);
  }

  // search for orders PENDING_MAKE and re-try submit them
  async recoverOnePendingOrder() {
    const order = this.orders.find(o => o.status === "PENDING_MAKE");
    if (!order) return;
    await order.submit();
    console.log("A pending order submitted.");
  }

  async terminateAndRestart() {
    this.fund += this.profit;
    const madeOrderIds = this.orders
      .filter(o => o.status === "MADE")
      .map(o => o.id);
    await api.post("swap/v3/cancel_batch_orders/ETH-USD-SWAP", {
      client_oids: madeOrderIds
    });
    this.orders = [];
    this.workers = [];
    if (
      [DirectionMode.RANDOM, DirectionMode.BUY, DirectionMode.SELL].includes(
        config.directionMode
      )
    ) {
      this.start();
    }
  }

  get profit() {
    return floor(this.openProfit + this.closedProfit, 6);
  }

  get profitRate() {
    return this.profit / this.fund;
  }

  get openProfit() {
    const openWorkers = this.workers.filter(w => w.status === "OPEN");
    return floor(
      openWorkers.reduce((acc, cur) => acc + (cur.profit || 0), 0),
      6
    );
  }

  get closedProfit() {
    const closedWorkers = this.workers.filter(w => w.status === "CLOSED");
    return floor(
      closedWorkers.reduce((acc, cur) => acc + (cur.profit || 0), 0),
      6
    );
  }

  get info() {
    const openWorkers = this.workers.filter(w => w.status === "OPEN");
    const closedWorkers = this.workers.filter(w => w.status === "CLOSED");
    const readyWorkers = this.workers.filter(w => w.status === "READY");
    const openInfo = openWorkers
      .map(w => {
        if (!w.openOrder) throw "no_open_order";
        return w.openOrder.summary;
      })
      .join("/");
    return `Workers ${openWorkers.length}|${readyWorkers.length}|${
      closedWorkers.length
    }, ${openInfo || "-"}, Profit ${this.openProfit}/${this.closedProfit}, ${(
      this.profitRate * 100
    ).toFixed(2)}%, ${(this.fund + this.profit).toFixed(4)}.`;
  }
}
