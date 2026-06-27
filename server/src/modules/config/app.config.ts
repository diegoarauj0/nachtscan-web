export default () => ({
  port: Number(process.env.PORT || 3000),
  redis: {
    port: Number(process.env.REDIS_PORT || 6379),
    host: process.env.REDIS_HOST || "127.0.0.1",
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  },
});
