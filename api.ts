import axios from "axios";

const apiBase = "https://www.okex.com";
export default axios.create({
  baseURL: apiBase
});
