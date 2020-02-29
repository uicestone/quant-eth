export default class Order {
  constructor(info: {
    direction: "BUY" | "SELL";
    state: "OPEN" | "CLOSE";
    price: number;
    amount: number;
  }) {
    const { state, direction, price, amount } = info;
    this.direction = direction;
    this.state = state;
    this.price = price;
    this.amount = amount;
    this.madeAt = new Date();
  }
  status: "PENDING_MAKE" | "MADE" | "FILLED" | "PARTLY_FILLED" = "MADE";
  type = "LIMIT";
  direction: "BUY" | "SELL";
  state: "OPEN" | "CLOSE";
  private _price: number = 0;
  amount: number; // 合约张数，1张为价值10USD的ETH
  fee?: number; // 手续费，单位ETH
  madeAt: Date;
  get summary() {
    return `${this.price}x${this.direction === "BUY" ? "" : "-"}${this.amount}`;
  }
  set price(v: number) {
    this._price = +v.toFixed(2);
  }
  get price() {
    return this._price;
  }
}
