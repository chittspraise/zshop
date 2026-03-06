import { Database } from './src/types/database.types';

type InsertOrderItem = Database['public']['Tables']['order_item']['Insert'];

export const item: InsertOrderItem = {
  order: 1,
  product: 1,
  quantity: 1,
};
