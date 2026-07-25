/*
 * Netlify Function: motor-api.js
 * Path: netlify/functions/motor-api.js
 *
 * GET  → returns { is_on: bool, start_time: string }
 * POST { type:"status",   is_on: bool }       → saves motor state
 * POST { type:"schedule", start_time: string } → saves start time
 *
 * Set DATABASE_URL in Netlify → Site Settings → Environment Variables
 * Format: postgresql://user:pass@host:port/dbname?sslmode=require
 */

import pg from 'pg';
const { Client } = pg;

const HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

const INIT_SQL = `
    CREATE TABLE IF NOT EXISTS motor_settings (
        id               INTEGER PRIMARY KEY DEFAULT 1,
        is_on            BOOLEAN NOT NULL DEFAULT FALSE,
        start_time       VARCHAR(20) DEFAULT '08:00 AM',
        updated_at       TIMESTAMPTZ DEFAULT NOW(),
        schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE
    );

    ALTER TABLE motor_settings ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE motor_settings ADD COLUMN IF NOT EXISTS front_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE motor_settings ADD COLUMN IF NOT EXISTS front_timer INTEGER NOT NULL DEFAULT 900000;
    ALTER TABLE motor_settings ADD COLUMN IF NOT EXISTS back_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE motor_settings ADD COLUMN IF NOT EXISTS back_timer INTEGER NOT NULL DEFAULT 900000;
    ALTER TABLE motor_settings ADD COLUMN IF NOT EXISTS down_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE motor_settings ADD COLUMN IF NOT EXISTS down_timer INTEGER NOT NULL DEFAULT 900000;
    ALTER TABLE motor_settings ADD COLUMN IF NOT EXISTS taps_order VARCHAR(255) DEFAULT '["front-tap","back-tap","down-tap"]';
    
    INSERT INTO motor_settings (id, is_on, start_time, schedule_enabled, front_enabled, front_timer, back_enabled, back_timer, down_enabled, down_timer, taps_order)
    VALUES (1, FALSE, '08:00 AM', FALSE, FALSE, 900000, FALSE, 900000, FALSE, 900000, '["front-tap","back-tap","down-tap"]')
    ON CONFLICT (id) DO NOTHING;
`;

export const handler = async (event) => {

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: HEADERS, body: '' };
    }

    // Aiven's connection string contains ?sslmode=require which overrides
    // the ssl object in pg's config parser. We strip it so our config works.
    let dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.includes('?')) {
        dbUrl = dbUrl.split('?')[0];
    }

    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        await client.query(INIT_SQL);

        // GET: load current settings
        if (event.httpMethod === 'GET') {
            const result = await client.query(
                'SELECT is_on, start_time, schedule_enabled, front_enabled, front_timer, back_enabled, back_timer, down_enabled, down_timer, taps_order FROM motor_settings WHERE id = 1'
            );
            return {
                statusCode: 200,
                headers: HEADERS,
                body: JSON.stringify(result.rows[0] || { 
                    is_on: false, start_time: '08:00 AM', schedule_enabled: false,
                    front_enabled: false, front_timer: 900000,
                    back_enabled: false, back_timer: 900000,
                    down_enabled: false, down_timer: 900000,
                    taps_order: '["front-tap","back-tap","down-tap"]'
                })
            };
        }

        // POST: save settings
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');

            if (body.type === 'status') {
                await client.query(
                    'UPDATE motor_settings SET is_on = $1, updated_at = NOW() WHERE id = 1',
                    [body.is_on === true || body.is_on === 'true']
                );
                return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
            }

            if (body.type === 'schedule') {
                await client.query(
                    'UPDATE motor_settings SET start_time = $1, updated_at = NOW() WHERE id = 1',
                    [body.start_time]
                );
                return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
            }

            if (body.type === 'schedule_toggle') {
                await client.query(
                    'UPDATE motor_settings SET schedule_enabled = $1, updated_at = NOW() WHERE id = 1',
                    [body.schedule_enabled === true || body.schedule_enabled === 'true']
                );
                return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
            }

            if (body.type === 'taps_config') {
                await client.query(
                    `UPDATE motor_settings SET 
                        front_enabled = $1, front_timer = $2,
                        back_enabled = $3, back_timer = $4,
                        down_enabled = $5, down_timer = $6,
                        taps_order = $7,
                        updated_at = NOW() 
                    WHERE id = 1`,
                    [
                        body.front_enabled === true, parseInt(body.front_timer) || 900000,
                        body.back_enabled === true, parseInt(body.back_timer) || 900000,
                        body.down_enabled === true, parseInt(body.down_timer) || 900000,
                        body.taps_order ? JSON.stringify(body.taps_order) : '["front-tap","back-tap","down-tap"]'
                    ]
                );
                return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
            }

            return {
                statusCode: 400,
                headers: HEADERS,
                body: JSON.stringify({ error: 'Unknown type. Use status, schedule, schedule_toggle, or taps_config' })
            };
        }

        return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (err) {
        console.error('DB Error:', err.message);
        return {
            statusCode: 500,
            headers: HEADERS,
            body: JSON.stringify({ error: err.message })
        };
    } finally {
        await client.end();
    }
};
