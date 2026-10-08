import { Db, MongoClient } from "mongodb";

let connection: Promise<MongoClient> | undefined;
export async function getMongoClient(): Promise<MongoClient | null> {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DB;
  if (!uri || !/^mongodb(?:\+srv)?:\/\/[^/?#]+/i.test(uri) || !database || database !== database.trim()) return null;
  if (!connection) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
    });
    connection = client.connect().catch(async (error) => {
      connection = undefined;
      await client.close().catch(() => undefined);
      throw error;
    });
  }
  return connection;
}
export async function getDb(): Promise<Db | null> {
  return (await getMongoClient())?.db(process.env.MONGODB_DB) ?? null;
}
