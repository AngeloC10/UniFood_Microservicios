CREATE TABLE IF NOT EXISTS menus (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL,
    cupos_disponibles INT NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO menus (nombre, descripcion, precio, cupos_disponibles) VALUES
('Menú Ejecutivo: Lomo Saltado', 'Sopa de quinua + Lomo + Chicha', 12.00, 25),
('Menú Económico: Seco de Pollo', 'Seco de Pollo + Chicha', 8.50, 40);
