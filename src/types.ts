export interface Table {
  id: number;
  capacity: number;
  status: 'available' | 'reserved' | 'occupied';
  reservationName?: string;
  reservationTime?: string;
  reservationContact?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'entradas' | 'fuertes' | 'bebidas' | 'postres';
  availableQty: number; // real-time portions count
  image: string;
}

export interface RestaurantState {
  tables: Table[];
  menu: MenuItem[];
}

export type RealtimeEvent =
  | { type: 'init'; state: RestaurantState }
  | { type: 'update'; state: RestaurantState };
