const Redis = require("ioredis");

const memoryStore = new Map();
let redisClient = null;

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    redisClient.on("error", (error) => {
      console.warn("Redis cache unavailable:", error.message);
    });
  }

  return redisClient;
}

async function getCachedJson(key) {
  const client = getRedisClient();
  if (client) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn("Redis get failed, falling back to memory cache:", error.message);
    }
  }

  const entry = memoryStore.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  return entry.value;
}

async function setCachedJson(key, value, ttlSeconds = 300) {
  const client = getRedisClient();
  if (client) {
    try {
      await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    } catch (error) {
      console.warn("Redis set failed, falling back to memory cache:", error.message);
    }
  }

  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

async function deleteCachedKey(key) {
  const client = getRedisClient();
  if (client) {
    try {
      await client.del(key);
    } catch (error) {
      console.warn("Redis delete failed:", error.message);
    }
  }

  memoryStore.delete(key);
}

module.exports = {
  getCachedJson,
  setCachedJson,
  deleteCachedKey,
};
