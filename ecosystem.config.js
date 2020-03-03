module.exports = {
  apps: [
    {
      name: "quant-eth",
      script: "./dist/index.js",
      // args: "-d R -l 200 -s 0.05 -m 6 -o 0.15 -f 5",
      autorestart: false,
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS (ZZ)",
      log: true,
      env: {
        TZ: "Asia/Shanghai"
      }
    }
  ]
};
