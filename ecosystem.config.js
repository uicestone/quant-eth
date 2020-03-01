module.exports = {
  apps: [
    {
      name: "quant-eth-1",
      script: "./dist/index.js",
      args: "-d R -l 200 -s 0.05 -o 0.15 -m 6 -f 5",
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS (ZZ)",
      log: true,
      env: {
        TZ: "Asia/Shanghai"
      }
    },
    {
      name: "quant-eth-2",
      script: "./dist/index.js",
      args: "-d B -l 200 -s 0.05 -o 0.15 -m 6 -f 5",
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS (ZZ)",
      log: true,
      env: {
        TZ: "Asia/Shanghai"
      }
    },
    {
      name: "quant-eth-3",
      script: "./dist/index.js",
      args: "-d S -l 200 -s 0.05 -o 0.15 -m 6 -f 5",
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS (ZZ)",
      log: true,
      env: {
        TZ: "Asia/Shanghai"
      }
    }
  ]
};
