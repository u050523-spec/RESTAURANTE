import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { RestaurantState, Table, MenuItem } from "./src/types.js";

// Keep clients list for Server-Sent Events (SSE)
let clients: any[] = [];

// Initialize 8 tables
const initialTables: Table[] = [
  { id: 1, capacity: 2, status: 'available' },
  { id: 2, capacity: 2, status: 'available' },
  { id: 3, capacity: 4, status: 'available' },
  { id: 4, capacity: 4, status: 'available' },
  { id: 5, capacity: 4, status: 'available' },
  { id: 6, capacity: 6, status: 'available' },
  { id: 7, capacity: 6, status: 'available' },
  { id: 8, capacity: 8, status: 'available' },
];

// Initialize exquisite Mexican menu
const initialMenu: MenuItem[] = [
  {
    id: "guac-especial",
    name: "Guacamole Especial",
    description: "Aguacate fresco machacado, pico de gallo, chile serrano y totopos hechos a mano.",
    price: 140,
    category: "entradas",
    availableQty: 15,
    image: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "quesadillas-flor",
    name: "Quesadillas de Flor de Calabaza",
    description: "Tres quesadillas de maíz azul con flor de calabaza y queso Oaxaca derretido.",
    price: 120,
    category: "entradas",
    availableQty: 10,
    image: "https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "tacos-cochinita",
    name: "Tacos de Cochinita Pibil",
    description: "Tres tacos de cerdo marinado en achiote y naranja agria, servidos con cebolla morada curtida.",
    price: 180,
    category: "fuertes",
    availableQty: 20,
    image: "/src/assets/images/tacos_cochinita_1779819952877.png"
  },
  {
    id: "enchiladas-suizas",
    name: "Enchiladas Suizas",
    description: "Tortillas rellenas de pollo, bañadas en salsa verde cremosa gratinadas con queso manchego.",
    price: 195,
    category: "fuertes",
    availableQty: 18,
    image: "/src/assets/images/enchiladas_suizas_1779819965817.png"
  },
  {
    id: "agua-fresca",
    name: "Agua de Horchata / Jamaica",
    description: "Aguas frescas artesanales elaboradas del día con ingredientes 100% naturales.",
    price: 45,
    category: "bebidas",
    availableQty: 30,
    image: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "flan-napolitano",
    name: "Flan Napolitano",
    description: "Delicioso flan casero cremoso, bañado en caramelo ámbar y un toque de menta.",
    price: 75,
    category: "postres",
    availableQty: 12,
    image: "/src/assets/images/flan_napolitano_1779819981477.png"
  }
];

// Server-authoritative in-memory state
const state: RestaurantState = {
  tables: initialTables,
  menu: initialMenu
};

// Helper to broadcast changes to all active SSE subscribers
function broadcastState() {
  const payload = JSON.stringify({ type: 'update', state });
  clients.forEach(client => {
    client.write(`data: ${payload}\n\n`);
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SSE endpoint for immediate updates
  app.get("/api/realtime", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    // Send current state on connection
    const payload = JSON.stringify({ type: 'init', state });
    res.write(`data: ${payload}\n\n`);

    clients.push(res);

    req.on("close", () => {
      clients = clients.filter(c => c !== res);
    });
  });

  // Get current state
  app.get("/api/state", (req, res) => {
    res.json(state);
  });

  // Make a table reservation
  app.post("/api/reserve", (req, res) => {
    const { tableId, name, time, contact } = req.body;
    
    if (!name || !time) {
      return res.status(400).json({ error: "El nombre y la hora son obligatorios." });
    }

    const table = state.tables.find(t => t.id === Number(tableId));
    if (!table) {
      return res.status(404).json({ error: "La mesa especificada no existe." });
    }

    if (table.status !== 'available') {
      return res.status(400).json({ error: "Esta mesa ya se encuentra reservada u ocupada." });
    }

    table.status = 'reserved';
    table.reservationName = name;
    table.reservationTime = time;
    table.reservationContact = contact || '';

    broadcastState();
    res.json({ success: true, table });
  });

  // Cancel/release table reservation
  app.post("/api/release", (req, res) => {
    const { tableId } = req.body;
    const table = state.tables.find(t => t.id === Number(tableId));
    
    if (!table) {
      return res.status(404).json({ error: "La mesa especificada no existe." });
    }

    table.status = 'available';
    delete table.reservationName;
    delete table.reservationTime;
    delete table.reservationContact;

    broadcastState();
    res.json({ success: true, table });
  });

  // Update table status to occupied
  app.post("/api/occupy", (req, res) => {
    const { tableId } = req.body;
    const table = state.tables.find(t => t.id === Number(tableId));

    if (!table) {
      return res.status(404).json({ error: "La mesa especificada no existe." });
    }

    table.status = 'occupied';
    broadcastState();
    res.json({ success: true, table });
  });

  // Order food menu items (decreases stock)
  app.post("/api/order", (req, res) => {
    const { items } = req.body as { items: { id: string; qty: number }[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "El pedido está vacío." });
    }

    // Verify stock first
    for (const orderItem of items) {
      const dbItem = state.menu.find(i => i.id === orderItem.id);
      if (!dbItem) {
        return res.status(404).json({ error: `El platillo con ID ${orderItem.id} no existe.` });
      }
      if (dbItem.availableQty < orderItem.qty) {
        return res.status(400).json({ 
          error: `Lo sentimos, solo quedan ${dbItem.availableQty} ración(es) de "${dbItem.name}".` 
        });
      }
    }

    // Process order (decrease portions)
    items.forEach(orderItem => {
      const dbItem = state.menu.find(i => i.id === orderItem.id)!;
      dbItem.availableQty -= orderItem.qty;
    });

    broadcastState();
    res.json({ success: true, menu: state.menu });
  });

  // Staff route: replenish/set dish available quantity
  app.post("/api/menu/update-stock", (req, res) => {
    const { itemId, qty } = req.body;
    const dbItem = state.menu.find(i => i.id === itemId);

    if (!dbItem) {
      return res.status(404).json({ error: "Platillo no encontrado." });
    }

    const parsedQty = Number(qty);
    if (isNaN(parsedQty) || parsedQty < 0) {
      return res.status(400).json({ error: "La cantidad de porciones debe ser un número entero mayor o igual a cero." });
    }

    dbItem.availableQty = parsedQty;
    broadcastState();
    res.json({ success: true, menuItem: dbItem });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server (Express + SSE) configured on http://localhost:${PORT}`);
  });
}

startServer();
