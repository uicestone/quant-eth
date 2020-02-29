import Worker from "./Worker";
import Order from "./Order";

export default class Trader {
  constructor(config: { lever: number; spacing: number; lot: number }) {
    const { lever, spacing, lot } = config;
    this.lever = lever;
    this.spacing = spacing;
    this.lot = lot;
    setInterval(() => {
      this.info();
    }, 2e4);
  }

  lever: number;
  spacing: number;
  lot: number;

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

  start(direction: "BUY" | "SELL", price?: number) {
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
      `[${new Date()}] ${openWorkers.length} open workers, ${openInfo}, ${
        closedWorkers.length
      } closed workers, open profit ${openProfit}, closed profit ${closedProfit}`
    );
    if (openWorkers.length === 0) {
      this.start("SELL");
    }
  }
}
