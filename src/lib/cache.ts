import { redis } from "./redis";

const DEFAULT_CACHE_TIME = 60 * 60 * 24

export const get = async <T>(key: string): Promise<T | null> => {
  const value: T | null = await redis.get(key);
  return value
};

export const set = async <T>(key: string, value: T, expiresInSeconds = DEFAULT_CACHE_TIME) => {
  console.log('attempting to cache', { key, value })
  return await redis.set(key, JSON.stringify(value), { ex: expiresInSeconds });
};