import { v1 as uuid } from "uuid";
import config from "../config";
import Worker from "./Worker";
import api from "../api";

export default class Order {
  constructor(
    public worker: Worker,
    public direction: "BUY" | "SELL",
    public state: "OPEN" | "CLOSE",
    public price: number,
    public amount: number, // 合约张数，1张为价值10USD的ETH
    public type = "LIMIT"
  ) {
    this.id = uuid().replace(/-/g, "");
    this.madeAt = new Date();
  }

  id: string;
  status: "PENDING_MAKE" | "MADE" | "FILLED" | "PARTLY_FILLED" = "PENDING_MAKE";
  madeAt: Date;
  fee = 0; // 手续费，单位ETH

  get summary() {
    return `${this.price.toFixed(2)}x${this.direction === "BUY" ? "" : "-"}${
      this.amount
    }`;
  }

  updateStatus(s: "PENDING_MAKE" | "MADE" | "FILLED" | "PARTLY_FILLED") {
    this.status = s;
    this.worker.orderStatusUpdated(this);
  }

  async submit() {
    if (config.mock) {
      return new Promise(resolve => {
        setTimeout(() => {
          this.updateStatus("MADE");
          resolve();
        }, 1e3);
      });
    }
    let type: string;
    if (this.state === "OPEN") {
      type = this.direction === "BUY" ? "1" : "2";
    } else {
      type = this.direction === "SELL" ? "3" : "4";
    }
    const data = {
      client_oid: this.id,
      size: this.amount.toString(),
      type,
      // order_type: "1", // 只做Maker
      price: this.price.toFixed(2),
      instrument_id: "ETH-USD-SWAP"
    };

    // console.log("Order submitting:", JSON.stringify(data));

    const res: {
      result: string;
      error_code: string;
      error_message: string;
      client_oid: string;
      order_id: string;
    } = await api.post("swap/v3/order", data);

    if (res.result !== "true") {
      console.error(
        `Order submit failed: ${res.error_message} ${res.error_code}.`
      );
    }
  }
}
