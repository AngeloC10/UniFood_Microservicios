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
('Menú Ejecutivo: Lomo Saltado', 'Sopa de quinua + Lomo saltado con papas fritas y arroz + Chicha morada', 12.00, 25),
('Menú Económico: Seco de Pollo', 'Sopa de fideos + Seco de pollo con frijoles y arroz + Chicha morada', 8.50, 40),
('Menú Ejecutivo: Ají de Gallina', 'Sopa de verduras + Ají de gallina con huevo, aceituna y arroz + Emoliente', 11.00, 30),
('Menú Económico: Arroz con Pollo', 'Sopa minestrone + Arroz con pollo y crema de huancaína + Refresco de cebada', 9.00, 35),
('Menú Económico: Escabeche de Pollo', 'Caldo de gallina + Escabeche de pollo con camote y arroz + Chicha morada', 8.50, 30),
('Menú Ejecutivo: Milanesa de Pollo', 'Sopa de lentejas + Milanesa de pollo con papas y ensalada + Limonada', 12.50, 25),
('Menú Regional: Adobo Cusqueño', 'Caldo de cordero + Adobo de cerdo con pan o arroz + Chicha morada', 14.00, 20),
('Menú Económico: Estofado de Carne', 'Sopa de morón + Estofado de res con zanahoria y alverjitas + Refresco de cebada', 9.50, 35),
('Menú Regional: Trucha Frita', 'Sopa de trigo + Trucha frita con yucas y ensalada criolla + Refresco de maracuyá', 13.50, 20),
('Menú Económico: Pescado a la Chorrillana', 'Chilcano de pescado + Filete a la chorrillana con arroz + Limonada', 9.00, 30),
('Menú Económico: Tallarines Rojos', 'Sopa de verduras + Tallarines rojos con presa de pollo + Chicha morada', 8.50, 40),
('Menú Vegetariano: Locro de Zapallo', 'Crema de zapallo + Locro con queso, arroz y huevo frito + Refresco de cebada', 8.00, 30),
('Menú Dieta: Saltado de Vainita', 'Sopa de dieta + Saltado de vainita con pechuga de pollo + Limonada', 9.00, 25),
('Menú Ejecutivo: Pollo al Horno', 'Sopa de trigo + Pollo al horno con puré de papas y arroz + Chicha morada', 12.00, 25),
('Menú Económico: Combinado Chanfainita', 'Sopa de fideos + Chanfainita con tallarín rojo + Emoliente', 8.00, 35);
