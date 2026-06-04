const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8080;

// ======================================
// CONFIGURACIÓN POSTGRESQL
// ======================================

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'perfumes_db',
    password: process.env.PGPASSWORD || '1234',
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
});

// ======================================
// MIDDLEWARES
// ======================================

app.use(cors());

app.use(express.json());

async function initializeDatabase() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            clave TEXT,
            apellido TEXT,
            direccion TEXT,
            cedula TEXT,
            ciudad_pais TEXT
        )`);

        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS clave TEXT`);
        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apellido TEXT`);
        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS direccion TEXT`);
        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cedula TEXT`);
        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ciudad_pais TEXT`);

        await pool.query(`DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'usuarios'
                    AND column_name = 'clave'
                ) THEN
                    ALTER TABLE usuarios ALTER COLUMN clave DROP NOT NULL;
                END IF;
            END
        $$;`);

        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cedula_idx ON usuarios(cedula)`);
    } catch (err) {
        console.error('Error inicializando la tabla de usuarios:', err);
    }
}

initializeDatabase();

// ======================================
// API BACKEND SOLAMENTE
// ======================================

// Este servidor solo expone la API de usuarios y no sirve archivos estáticos.
// Si deseas añadir frontend, puedes descomentar las siguientes líneas
// y agregar una carpeta `public`.

// app.use(express.static(path.join(__dirname, 'public')));
//
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// ======================================
// OBTENER USUARIOS (para debug)
// ======================================

app.get('/api/usuarios', async (req, res) => {

    try {

        const result = await pool.query(
            'SELECT id, nombre, apellido, cedula, ciudad_pais FROM usuarios'
        );

        res.json(result.rows);

    } catch (err) {

        console.error(
            'Error obteniendo usuarios:',
            err
        );

        res.status(500).json({
            error: 'Error en el servidor'
        });
    }
});

// ======================================
// REGISTRO DE USUARIOS
// ======================================

app.post('/api/registro', async (req, res) => {

    const { nombre, clave, apellido, direccion, cedula, ciudadPais } = req.body;

    console.log('Intento de registro:', { nombre, apellido, direccion, cedula, ciudadPais });

    try {

        const hashedClave = await bcrypt.hash(clave, 10);

        await pool.query(
            `
            INSERT INTO usuarios
            (nombre, clave, apellido, direccion, cedula, ciudad_pais)
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [nombre, hashedClave, apellido, direccion, cedula, ciudadPais]
        );

        console.log('Usuario registrado exitosamente');

        res.json({
            mensaje: 'Usuario registrado correctamente'
        });

    } catch (err) {

        console.error(
            'Error registrando usuario:',
            err
        );

        res.status(500).json({
            error: 'Error al registrar usuario'
        });
    }
});

// ======================================
// LOGIN
// ======================================

app.post('/api/login', async (req, res) => {

    const { nombre, clave } = req.body;

    console.log('Intento de login:', { nombre });

    try {

        const result = await pool.query(
            `
            SELECT *
            FROM usuarios
            WHERE nombre = $1
            `,
            [nombre]
        );

        console.log('Resultado de consulta:', result.rows.length, 'filas encontradas');

        if(result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                mensaje: 'Usuario o clave incorrectos'
            });
        }

        const usuario = result.rows[0];
        const match = await bcrypt.compare(clave, usuario.clave);

        if (!match) {
            return res.status(401).json({
                success: false,
                mensaje: 'Usuario o clave incorrectos'
            });
        }

        res.json({
            success: true,
            mensaje: 'Login correcto'
        });

    } catch (err) {
        console.error(
            'Error login:',
            err
        );

        res.status(500).json({
            error: 'Error servidor'
        });
    }
});

// ======================================
// INICIAR SERVIDOR
// ======================================

app.listen(PORT, () => {

    console.log(
        `Servidor listo en: http://localhost:${PORT}`
    );
});