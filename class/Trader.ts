import moment from "moment";
import Worker from "./Worker";
import Order from "./Order";
import config, { DirectionMode } from "../config";
import { floor } from "../helpers";

export default class Trader {
  constructor(
    public directionMode: DirectionMode,
    public lever: number,
    public spacing: number,
    public lot: number,
    public fund: number
  ) {
    setInterval(() => {
      this.info();
    }, 2e4); // 每20秒输出持仓信息
  }

  last?: number;

  maxOpenWorkers = config.maxOpenWorkers;
  workers: Worker[] = [];
  orders: Order[] = [];

  updateLast(price: number) {
    // console.log("updateLast:", price);
    this.last = price;
    for (const w of this.workers) {
      w.notifyLast();
    }
  }

  start(price?: number) {
    let direction: "BUY" | "SELL";
    if (this.directionMode === DirectionMode.BUY) {
      direction = "BUY";
    } else if (this.directionMode === DirectionMode.SELL) {
      direction = "SELL";
    } else if (this.directionMode === DirectionMode.RANDOM) {
      direction = Math.random() > 0.5 ? "BUY" : "SELL";
    } else {
      throw `Direction mode ${this.directionMode} not supported.`;
    }
    console.log(`Start trade: ${direction}`);
    const w = new Worker(this);
    w.open(direction);
    this.workers.push(w);
  }

  requestBackup(worker: Worker) {
    if (
      this.workers.filter(w => w.status !== "CLOSED").length >=
      this.maxOpenWorkers
    ) {
      console.log("Max workers exceeded, backup failed.");
      return;
    }
    const w = new Worker(this);
    if (!worker.openOrder) throw "no_open_order";
    w.open(
      worker.openOrder.direction,
      worker.openOrder.price *
        (1 +
          (this.spacing / this.lever) *
            (worker.openOrder.direction === "BUY" ? -1 : 1))
    );
    this.workers.push(w);
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

  info() {
    const openWorkers = this.workers.filter(w => w.status === "OPEN");
    const closedWorkers = this.workers.filter(w => w.status === "CLOSED");
    const readyWorkers = this.workers.filter(w => w.status === "READY");
    const openInfo = openWorkers
      .map(w => {
        if (!w.openOrder) throw "no_open_order";
        return w.openOrder.summary;
      })
      .join("/");
    console.info(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] workers ${
        openWorkers.length
      }|${readyWorkers.length}|${closedWorkers.length}, ${openInfo ||
        "-"}, profit ${this.openProfit}/${this.closedProfit}, ${(
        this.profitRate * 100
      ).toFixed(2)}%, ${(this.fund + this.profit).toFixed(4)}`
    );
    if (this.profitRate < -config.overLoss) {
      console.log(
        `Profit rate ${this.profitRate} hit loss line, close all orders.`
      );
      // 平仓所有订单
      process.exit();
    }
  }

  workerClosed(worker: Worker) {
    const openWorkers = this.workers.filter(w => w.status === "OPEN");
    if (openWorkers.length === 0) {
      this.fund += this.profit;
      this.orders = [];
      this.workers = [];
      this.start();
    }
  }
}
