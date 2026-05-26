import React, { useState, useEffect, useRef } from 'react';
import {
  Utensils,
  ChefHat,
  CalendarDays,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Trash2,
  User,
  Phone,
  Clock,
  ShoppingBag,
  X,
  Sparkles,
  RefreshCw,
  Bell,
  Check,
  Building,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Table, MenuItem, RestaurantState } from './types';

export default function App() {
  // Application Roles: 'client' | 'staff'
  const [role, setRole] = useState<'client' | 'staff'>('client');
  
  // Real-time State from server
  const [state, setState] = useState<RestaurantState>({
    tables: [],
    menu: []
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Active Customer Order/Cart
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  
  // Category Filtering
  const [activeCategory, setActiveCategory] = useState<string>('todos');

  // Reservation Form State
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [reserveName, setReserveName] = useState<string>('');
  const [reserveTime, setReserveTime] = useState<string>('19:00');
  const [reserveContact, setReserveContact] = useState<string>('');
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserveSuccess, setReserveSuccess] = useState<boolean>(false);

  // General Notification Logs (for demonstrating real-time events)
  const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; type: 'info' | 'success' | 'warn' }[]>([]);

  // Sound or flash effect when stock or tables update
  const previousStateRef = useRef<RestaurantState | null>(null);

  // Connect to SSE for real-time synchronization
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connectSSE() {
      // Connect to the Express-managed event stream
      eventSource = new EventSource("/api/realtime");

      eventSource.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'init' || payload.type === 'update') {
            const newState: RestaurantState = payload.state;
            
            // Generate friendly toast notifications by comparing with previous state
            if (previousStateRef.current) {
              const prev = previousStateRef.current;
              
              // 1. Check for newly reserved tables
              newState.tables.forEach(currTable => {
                const prevTable = prev.tables.find(t => t.id === currTable.id);
                if (prevTable && prevTable.status !== 'reserved' && currTable.status === 'reserved') {
                  addNotification(
                    `Mesa ${currTable.id} ha sido reservada por ${currTable.reservationName}!`,
                    'success'
                  );
                } else if (prevTable && prevTable.status !== 'available' && currTable.status === 'available') {
                  addNotification(
                    `Mesa ${currTable.id} se encuentra disponible nuevamente.`,
                    'info'
                  );
                } else if (prevTable && prevTable.status !== 'occupied' && currTable.status === 'occupied') {
                  addNotification(
                    `Mesa ${currTable.id} ahora está ocupada (¡Disfrutando sus platillos!).`,
                    'info'
                  );
                }
              });

              // 2. Check for menu stock updates or orders
              newState.menu.forEach(currDish => {
                const prevDish = prev.menu.find(d => d.id === currDish.id);
                if (prevDish) {
                  if (prevDish.availableQty > currDish.availableQty) {
                    const diff = prevDish.availableQty - currDish.availableQty;
                    addNotification(
                      `Se ordenaron ${diff} porción(es) de "${currDish.name}". ¡Quedan ${currDish.availableQty}!`,
                      currDish.availableQty <= 3 ? 'warn' : 'info'
                    );
                  } else if (prevDish.availableQty < currDish.availableQty) {
                    addNotification(
                      `Se abasteció el platillo "${currDish.name}". Ahora hay ${currDish.availableQty} raciones.`,
                      'success'
                    );
                  }
                }
              });
            }

            setState(newState);
            previousStateRef.current = newState;
          }
        } catch (err) {
          console.error("Error parsing SSE stream message:", err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setConnectionError("Conexión perdida con el servidor. Reintentando...");
        eventSource?.close();
        
        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Sync client state periodically if SSE isn't active
  useEffect(() => {
    fetchState();
  }, []);

  const fetchState = async () => {
    try {
      const response = await fetch("/api/state");
      if (response.ok) {
        const data: RestaurantState = await response.json();
        setState(data);
        previousStateRef.current = data;
      }
    } catch (e) {
      console.error("Error manual fetching state:", e);
    }
  };

  const addNotification = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const timeString = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setNotifications(prev => [
      { id: Math.random().toString(), text, time: timeString, type },
      ...prev.slice(0, 14) // keep last 15
    ]);
  };

  // Reservation Action Submit
  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setReserveError(null);
    setReserveSuccess(false);

    try {
      const response = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable.id,
          name: reserveName,
          time: reserveTime,
          contact: reserveContact
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        setReserveError(resData.error || "Código de error inesperado en reserva.");
      } else {
        setReserveSuccess(true);
        setReserveName('');
        setReserveContact('');
        setTimeout(() => {
          setSelectedTable(null);
          setReserveSuccess(false);
        }, 1800);
      }
    } catch (err) {
      setReserveError("Error al conectar con la pasarela de reservas.");
    }
  };

  // Cancel/Release table (Customer or Staff)
  const handleReleaseTable = async (tableId: number) => {
    try {
      const response = await fetch("/api/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId })
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Mark table as occupied (Staff only)
  const handleOccupyTable = async (tableId: number) => {
    try {
      const response = await fetch("/api/occupy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId })
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Cart operations
  const addToCart = (dishId: string, maxAvailable: number) => {
    const currentQty = cart[dishId] || 0;
    if (currentQty >= maxAvailable) {
      alert(`Lo sentimos, solo quedan ${maxAvailable} unidades disponibles en la cocina.`);
      return;
    }
    setCart(prev => ({
      ...prev,
      [dishId]: currentQty + 1
    }));
  };

  const removeFromCart = (dishId: string) => {
    const currentQty = cart[dishId] || 0;
    if (currentQty <= 1) {
      const copy = { ...cart };
      delete copy[dishId];
      setCart(copy);
    } else {
      setCart(prev => ({
        ...prev,
        [dishId]: currentQty - 1
      }));
    }
  };

  const removeEntirelyFromCart = (dishId: string) => {
    const copy = { ...cart };
    delete copy[dishId];
    setCart(copy);
  };

  const handleOrderSubmit = async () => {
    const itemsPayload = Object.keys(cart).map(id => ({
      id,
      qty: cart[id]
    }));

    if (itemsPayload.length === 0) return;

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsPayload })
      });

      const resData = await response.json();
      if (!response.ok) {
        alert(resData.error || "Ocurrió un error al procesar el pedido.");
      } else {
        alert("¡Pedido realizado con éxito! La cocina ha recibido tu comanda y las porciones se han descontado.");
        setCart({});
      }
    } catch (e) {
      alert("Error al conectar con la pasarela de pedidos.");
    }
  };

  // Staff replenish quantity
  const handleUpdateStock = async (itemId: string, newQty: number) => {
    try {
      const response = await fetch("/api/menu/update-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, qty: newQty })
      });
      if (!response.ok) {
        const resData = await response.json();
        alert(resData.error || "Error al actualizar ración.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Calculations for checkout
  const cartTotal = Object.keys(cart).reduce((sum, dishId) => {
    const dish = state.menu.find(m => m.id === dishId);
    return sum + (dish ? dish.price * cart[dishId] : 0);
  }, 0);

  const totalCartItems = Object.keys(cart).reduce((sum, id) => sum + cart[id], 0);

  const filteredMenu = activeCategory === 'todos' 
    ? state.menu 
    : state.menu.filter(item => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#fcfbf7] flex flex-col antialiased">
      {/* Real-time Connection Toast Alert if Offline */}
      {connectionError && (
        <div className="bg-red-50 text-red-700 px-4 py-2.5 text-center text-sm font-medium border-b border-red-200 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 animate-bounce" />
          <span>{connectionError}</span>
          <button onClick={fetchState} className="underline ml-2 hover:text-red-950 font-semibold flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" /> Forzar actualización
          </button>
        </div>
      )}

      {/* Primary Brand Navbar Header */}
      <header className="sticky top-0 z-40 bg-[#1e1c18] text-[#fcfbf7] shadow-lg border-b border-[#302c26]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#e7bb41] text-[#1e1c18] rounded-xl flex items-center justify-center shadow-lg">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-2xl tracking-normal text-[#fcfbf7]">
                Sabor y Mesa
              </h1>
              <p className="text-xs text-[#a29b90] font-medium tracking-wider uppercase flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                {isConnected ? 'Sincronizado en Tiempo Real' : 'Sincronizando...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            {/* Visual Role Switcher to allow user testing both Client and Staff interfaces */}
            <div className="bg-[#292621] p-1 rounded-xl border border-[#3e3931] flex w-full md:w-auto items-center">
              <button
                id="role-client-btn"
                onClick={() => setRole('client')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold tracking-tight transition-all duration-300 flex items-center justify-center gap-2 ${
                  role === 'client'
                    ? 'bg-[#e7bb41] text-[#1e1c18] shadow-md'
                    : 'text-[#d6cfc5] hover:text-[#fcfbf7] hover:bg-[#34302a]'
                }`}
              >
                <Users className="w-4 h-4" />
                Vista de Cliente
              </button>
              <button
                id="role-staff-btn"
                onClick={() => setRole('staff')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold tracking-tight transition-all duration-300 flex items-center justify-center gap-2 ${
                  role === 'staff'
                    ? 'bg-[#c19c35] text-[#fcfbf7] shadow-md'
                    : 'text-[#d6cfc5] hover:text-[#fcfbf7] hover:bg-[#34302a]'
                }`}
              >
                <ChefHat className="w-4 h-4" />
                Cocina / Admin
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Visual Ambient Banner Hero */}
      <section className="relative h-[220px] md:h-[300px] bg-[#1a1917] overflow-hidden">
        <img
          src="/src/assets/images/restaurant_hero_1779819931809.png"
          alt="Atmósfera del Restaurante Sabor y Mesa"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1917] via-transparent to-black/40"></div>
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8 text-[#fcfbf7]">
            <span className="bg-[#e7bb41] text-[#1e1c18] text-xs font-bold px-3 py-1 rounded-full tracking-wide uppercase">
              Gastronomía Mexicana Fina
            </span>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl mt-2 tracking-tight">
              Bienvenido a Sabor y Mesa
            </h2>
            <p className="text-[#d6cfc5] mt-1 text-sm md:text-base max-w-2xl font-light">
              Disfruta de nuestros platillos estrella preparados al instante. Reserva de inmediato una de nuestras 8 mesas exclusivas y observa la disponibilidad de porciones en tiempo real.
            </p>
          </div>
        </div>
      </section>

      {/* Main Workspace Dashboard Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Real-time Live Interaction Sidebar logs + Table Reservation */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Section: Reservation of 8 Tables */}
          <div id="reservation-card" className="bg-[#ffffff] border border-[#e8e4db] rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between border-b border-[#f2efe8] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#c19c35]" />
                <h3 className="font-display font-bold text-lg text-[#2a2926]">
                  Reserva de Mesas
                </h3>
              </div>
              <span className="bg-[#f0ece3] text-[#5e584f] text-[11px] font-mono font-semibold px-2 py-0.5 rounded">
                8 MESAS DISPONIBLES
              </span>
            </div>

            <p className="text-xs text-[#6e685f] mb-4">
              {role === 'client' 
                ? "Selecciona una mesa libre abajo para realizar tu reserva inmediatamente. Los cambios se sincronizan en vivo en todas las pantallas."
                : "Consola Administrativa: Haz clic en cualquier mesa reservada u ocupada para liberar el espacio o cambiar su estado de recepción."}
            </p>

            {/* Grid of exactly 8 mesas */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-3.5">
              {state.tables.map((table) => {
                const isSelected = selectedTable?.id === table.id;
                
                // Color badges for reservation states
                let borderStyle = 'border-[#e0dfd3] hover:border-[#c19c35]';
                let bgStyle = 'bg-white';
                let statusBadge = (
                  <span className="inline-flex items-center text-[10px] font-semibold text-[#16a34a] bg-emerald-50 px-1.5 py-0.5 rounded-full mt-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>Disponible
                  </span>
                );

                if (table.status === 'reserved') {
                  borderStyle = 'border-amber-400 bg-amber-50/30';
                  statusBadge = (
                    <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full mt-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1"></span>Reservada
                    </span>
                  );
                } else if (table.status === 'occupied') {
                  borderStyle = 'border-red-300 bg-red-50/20';
                  statusBadge = (
                    <span className="inline-flex items-center text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full mt-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1"></span>En Consumo
                    </span>
                  );
                }

                if (isSelected) {
                  borderStyle = 'ring-2 ring-[#c19c35] border-[#c19c35] bg-amber-50/20';
                }

                return (
                  <div
                    key={table.id}
                    id={`table-card-${table.id}`}
                    onClick={() => {
                      if (role === 'client') {
                        if (table.status === 'available') {
                          setSelectedTable(table);
                          setReserveError(null);
                        } else {
                          alert(`La Mesa ${table.id} ya se encuentra ocupada o reservada por ${table.reservationName}.`);
                        }
                      }
                    }}
                    className={`border rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-200 ${borderStyle} ${bgStyle}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-display font-extrabold text-base text-[#1a1917]">
                        Mesa {table.id}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded-md">
                        <Users className="w-3 h-3 text-slate-400" /> {table.capacity}p
                      </span>
                    </div>

                    {/* Table occupant details */}
                    {table.status !== 'available' ? (
                      <div className="mt-2 text-left">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {table.reservationName}
                        </p>
                        {table.reservationTime && (
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-amber-500" /> {table.reservationTime}
                          </p>
                        )}

                        {/* Staff Actions controls on Mesa */}
                        {role === 'staff' && (
                          <div className="mt-2.5 pt-2 border-t border-[#f2efe8]/80 flex flex-col gap-1">
                            {table.status === 'reserved' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOccupyTable(table.id);
                                }}
                                className="w-full text-center text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white py-1 rounded"
                              >
                                Sentar comensal
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReleaseTable(table.id);
                              }}
                              className="w-full text-center text-[10px] font-bold bg-[#8c2f1b] hover:bg-[#a6371e] text-white py-1 rounded"
                            >
                              Liberar Mesa
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4">
                        {role === 'client' ? (
                          <span className="text-[10px] tracking-tight text-[#aa9d8a] font-bold block">
                            Haga clic para reservar
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#16a34a] font-semibold block">
                            Libre para asignar
                          </span>
                        )}
                      </div>
                    )}

                    {statusBadge}
                  </div>
                );
              })}
            </div>

            {/* Selected Booking Form (Client reservation popup container inside cards) */}
            <AnimatePresence>
              {selectedTable && role === 'client' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-[#f2efe8] bg-slate-50/80 p-3 rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      Reservando <span className="text-[#c19c35]">Mesa {selectedTable.id}</span> ({selectedTable.capacity} personas)
                    </span>
                    <button onClick={() => setSelectedTable(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleReserveSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Nombre de la Reserva *
                      </label>
                      <input
                        type="text"
                        required
                        value={reserveName}
                        onChange={(e) => setReserveName(e.target.value)}
                        placeholder="Ej. Familia Rodríguez"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#c19c35] outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Hora *
                        </label>
                        <select
                          value={reserveTime}
                          onChange={(e) => setReserveTime(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#c19c35] outline-none"
                        >
                          <option value="14:00">02:00 PM</option>
                          <option value="15:00">03:00 PM</option>
                          <option value="16:00">04:00 PM</option>
                          <option value="19:00">07:00 PM</option>
                          <option value="20:00">08:00 PM</option>
                          <option value="21:00">09:00 PM</option>
                          <option value="22:00">10:00 PM</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Teléfono de Contacto
                        </label>
                        <input
                          type="tel"
                          value={reserveContact}
                          onChange={(e) => setReserveContact(e.target.value)}
                          placeholder="Ej. 5512345678"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#c19c35] outline-none"
                        />
                      </div>
                    </div>

                    {reserveError && (
                      <p className="text-[11px] text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {reserveError}
                      </p>
                    )}

                    {reserveSuccess ? (
                      <div className="bg-emerald-50 text-emerald-700 p-2 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Mesa Reservada con éxito!
                      </div>
                    ) : (
                      <button
                        type="submit"
                        className="w-full bg-[#1e1c18] hover:bg-[#34302a] text-[#fcfbf7] font-bold text-xs py-2 rounded-lg transition-colors shadow-sm"
                      >
                        Confirmar Reserva Instantánea
                      </button>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Real-time Activity Feeds & Interactive Notifications log */}
          <div className="bg-white border border-[#e8e4db] rounded-2xl shadow-sm p-5 flex flex-col flex-1 min-h-[220px]">
            <div className="flex items-center justify-between border-b border-[#f2efe8] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#c19c35]" />
                <h3 className="font-display font-bold text-base text-[#2a2926]">
                  Notificaciones en Vivo
                </h3>
              </div>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>

            <p className="text-[11px] text-[#6e685f] mb-3">
              Actividad del restaurante sincronizada. Abre esta app en otra pestaña del navegador para ver cambios reflejarse instantáneamente al ordenar o reservar.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[250px]">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-6 text-slate-400">
                  <Info className="w-6 h-6 mb-1 text-slate-300" />
                  <p className="text-xs">Esperando interacciones en vivo en el sitio...</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={`p-2.5 rounded-lg border text-xs flex gap-2 items-start ${
                        notif.type === 'success' 
                          ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                          : notif.type === 'warn'
                          ? 'bg-amber-50/50 border-amber-100 text-amber-800'
                          : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-[#aa9d8a] pt-0.5">{notif.time}</span>
                      <p className="flex-1 leading-normal font-medium">{notif.text}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Menu Items Category Selector & Dishes Listing with Real-time metrics */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Menu Visualization Panel container */}
          <div className="bg-[#ffffff] border border-[#e8e4db] rounded-2xl shadow-sm p-6">
            
            {/* Header of Menu section with active filter tags */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#f2efe8] pb-4 mb-6 gap-3">
              <div>
                <span className="text-xs font-bold text-[#c19c35] tracking-wider uppercase">Nuestra Cocina</span>
                <h3 className="font-display font-extrabold text-2xl text-[#1a1917]">
                  Menú Auténtico Gourmet
                </h3>
              </div>

              {/* Quick Category Filtering Navigation Pill */}
              <div className="flex flex-wrap gap-1 bg-[#f5f3ec] p-1 rounded-xl border border-[#e8e4db]">
                {['todos', 'entradas', 'fuertes', 'bebidas', 'postres'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      activeCategory === cat
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMenu.map((dish) => {
                const qtyInCart = cart[dish.id] || 0;
                
                return (
                  <div
                    key={dish.id}
                    id={`menu-item-card-${dish.id}`}
                    className="border border-[#ebe6df] rounded-xl overflow-hidden shadow-sm flex flex-col bg-white hover:shadow-md transition-shadow duration-200"
                  >
                    {/* Portion availability indicator strip */}
                    <div className="relative h-44 bg-slate-100">
                      <img
                        src={dish.image}
                        alt={dish.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Portions indicator badge */}
                      <div className="absolute top-3 left-3 flex gap-1.5 flex-col">
                        {dish.availableQty > 5 ? (
                          <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            {dish.availableQty} porciones libres
                          </span>
                        ) : dish.availableQty > 0 ? (
                          <span className="bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1 animate-pulse">
                            ¡Últimas {dish.availableQty} raciones!
                          </span>
                        ) : (
                          <span className="bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow">
                            ¡Agotado!
                          </span>
                        )}
                        
                        {qtyInCart > 0 && (
                          <span className="bg-[#1e1c18] text-[#e7bb41] text-[10px] font-extrabold px-2 py-0.5 rounded-lg border border-[#e7bb41]">
                            {qtyInCart} agregados a tu orden
                          </span>
                        )}
                      </div>

                      {/* Display category label */}
                      <span className="absolute bottom-3 right-3 bg-black/65 backdrop-blur-sm text-white text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded">
                        {dish.category}
                      </span>
                    </div>

                    {/* Content Area of Dish Card */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-display font-bold text-base text-[#1a1917] leading-snug">
                            {dish.name}
                          </h4>
                          <span className="font-display font-extrabold text-base text-[#c19c35] flex-shrink-0">
                            ${dish.price} MXN
                          </span>
                        </div>
                        <p className="text-xs text-[#6e685f] mt-1.5 leading-relaxed font-light">
                          {dish.description}
                        </p>
                      </div>

                      {/* Controls Row (switches functionality depending on Client or Staff view) */}
                      <div className="mt-4 pt-3.5 border-t border-[#f2efe8] flex items-center justify-between">
                        {role === 'client' ? (
                          // Client UI controls: Add items to order basket
                          <div className="w-full flex items-center gap-2">
                            {qtyInCart > 0 ? (
                              <div className="flex items-center w-full justify-between">
                                <div className="flex items-center gap-2 bg-[#f5f3ec] rounded-lg border border-[#ebe6df] p-1">
                                  <button
                                    onClick={() => removeFromCart(dish.id)}
                                    className="p-1 hover:bg-[#e2dfd5] text-slate-800 rounded transition-colors"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-xs font-bold px-2 text-slate-800 min-w-4 text-center">
                                    {qtyInCart}
                                  </span>
                                  <button
                                    onClick={() => addToCart(dish.id, dish.availableQty)}
                                    className="p-1 hover:bg-[#e2dfd5] text-slate-800 rounded transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => removeEntirelyFromCart(dish.id)}
                                  className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Quitar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(dish.id, dish.availableQty)}
                                disabled={dish.availableQty === 0}
                                className={`w-full py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                                  dish.availableQty > 0
                                    ? 'bg-[#1e1c18] hover:bg-[#34302a] text-[#fcfbf7]'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {dish.availableQty > 0 ? 'Agregar al Pedido' : 'Temporalmente Agotado'}
                              </button>
                            )}
                          </div>
                        ) : (
                          // Staff/Cocina UI: Quick Stock Replenisher / Available Portion management
                          <div className="w-full">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                              Panel de Control de Porciones (Cocina)
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 flex items-center bg-[#f5f3ec] rounded-lg border border-[#ebe6df] p-1 justify-between max-w-[150px]">
                                <button
                                  onClick={() => handleUpdateStock(dish.id, Math.max(0, dish.availableQty - 1))}
                                  className="p-1 hover:bg-[#e2dfd5] text-slate-800 rounded"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-mono font-bold px-2 text-slate-800">
                                  {dish.availableQty} raciones
                                </span>
                                <button
                                  onClick={() => handleUpdateStock(dish.id, dish.availableQty + 1)}
                                  className="p-1 hover:bg-[#e2dfd5] text-slate-800 rounded"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex gap-1 items-center flex-1">
                                <button
                                  onClick={() => handleUpdateStock(dish.id, 15)}
                                  className="px-2 py-1.5 bg-[#1e1c18] hover:bg-slate-700 text-white rounded font-bold text-[10px] text-center"
                                >
                                  Fijar 15
                                </button>
                                <button
                                  onClick={() => handleUpdateStock(dish.id, 0)}
                                  className="px-2 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded font-bold text-[10px] text-center"
                                >
                                  Agotar (0)
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Customer Interactive Active Billing / Order Cart Section */}
          <AnimatePresence>
            {role === 'client' && totalCartItems > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                className="bg-[#1e1c18] text-white rounded-2xl p-5 shadow-xl border border-[#3e3931] flex flex-col md:flex-row items-center justify-between gap-5 sticky bottom-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-[#e7bb41] rounded-xl text-[#1e1c18] flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-display font-extrabold text-lg text-white">
                      Pedido Listo: {totalCartItems} platillo(s)
                    </h4>
                    <p className="text-xs text-[#a29b90] font-mono mt-0.5">
                      Subtotal: <span className="text-[#e7bb41] font-bold text-sm">${cartTotal} MXN</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <button
                    onClick={() => {
                      if (confirm("¿Estás seguro de que deseas vaciar tu carrito actual?")) {
                        setCart({});
                      }
                    }}
                    className="px-4 py-2 hover:bg-[#34302a] text-[#d6cfc5] rounded-xl text-xs font-bold transition-all"
                  >
                    Vaciar Carrito
                  </button>
                  <button
                    id="submit-order-button"
                    onClick={handleOrderSubmit}
                    className="bg-[#e7bb41] hover:bg-[#c19c35] text-[#1e1c18] px-6 py-2.5 rounded-xl text-xs font-display font-bold shadow transition-all duration-300 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-slate-900" />
                    Enviar Pedido a Cocina
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Real-Time Simulator Helpers */}
          <div className="bg-[#fcfbf7] border border-[#e8e4db]/80 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-[#c19c35] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">¿Cómo probar la sincronización en tiempo real?</span>
              <p className="mt-1 leading-normal">
                Usa el botón de arriba <b>"Cocina / Admin"</b> para alterar la cantidad de porciones o liberar mesas. También puedes abrir dos pestañas del navegador en paralelo con esta misma URL. Cualquier pedido enviado o cambio de mesa realizado en una pestaña se reflejará al instante en la otra de forma automatizada por el protocolo SSE de nuestro backend.
              </p>
            </div>
          </div>

        </div>

      </main>

      {/* Humble, Professional Footer */}
      <footer className="bg-[#1a1917] text-slate-400 py-6 border-t border-[#302c26] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs gap-3">
          <p>© 2026 Restaurante Sabor y Mesa. Todos los derechos reservados.</p>
          <div className="flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <p>Sistema Autorizado para Control de Mesas y Porciones del Chef </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
