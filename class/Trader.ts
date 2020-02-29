import moment from "moment";
import Worker from "./Worker";
import Order from "./Order";
import { DirectionMode } from "../config";

export default class Trader {
  constructor(
    public directionMode: DirectionMode,
    public lever: number,
    public spacing: number,
    public lot: number
  ) {
    setInterval(() => {
      this.info();
    }, 2e4); // 每20秒输出持仓信息
  }

  last?: number;

  maxOpenWorkers = 3;
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

  info() {
    const openWorkers = this.workers.filter(w => w.status === "OPEN");
    const closedWorkers = this.workers.filter(w => w.status === "CLOSED");
    const readyWorkers = this.workers.filter(w => w.status === "READY");
    const openProfit =
      Math.floor(
        openWorkers.reduce((acc, cur) => acc + (cur.profit || 0), 0) * 1e6
      ) / 1e6;
    const closedProfit =
      Math.floor(
        closedWorkers.reduce((acc, cur) => acc + (cur.profit || 0), 0) * 1e6
      ) / 1e6;
    const openInfo = openWorkers
      .map(w => {
        if (!w.openOrder) throw "no_open_order";
        return w.openOrder.summary;
      })
      .join("/");
    console.info(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")}] ${openWorkers.length}|${
        closedWorkers.length
      }|${
        readyWorkers.length
      } workers, ${openInfo}, open profit ${openProfit}, closed profit ${closedProfit}`
    );
    if (openWorkers.length === 0) {
      this.start();
    }
  }
}
