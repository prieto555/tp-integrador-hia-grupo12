-- Esquema de la base de datos de RestoYa.
-- Generado con: pg_dump --schema-only --no-owner --no-privileges
-- Fecha: 2026-11-09
-- Entregable del punto 4 de la consigna.

--
-- PostgreSQL database dump
--

\restrict U7960itwlkoTBrRNEF0yVwBMKjNtYpY3ph2OPy3sR2mIsCKG1IdkKkUrpTGlsal

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: enum_cajas_estado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_cajas_estado AS ENUM (
    'ABIERTA',
    'CERRADA'
);


--
-- Name: enum_mesas_estado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_mesas_estado AS ENUM (
    'LIBRE',
    'OCUPADA',
    'RESERVADA'
);


--
-- Name: enum_pagos_metodoPago; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_pagos_metodoPago" AS ENUM (
    'EFECTIVO',
    'TARJETA',
    'TRANSFERENCIA',
    'MERCADOPAGO'
);


--
-- Name: enum_pedidos_estado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_pedidos_estado AS ENUM (
    'PENDIENTE',
    'EN_COCINA',
    'LISTO_PARA_ENTREGA',
    'ENTREGADO',
    'PAGADO',
    'CANCELADO'
);


--
-- Name: enum_pedidos_tipoPedido; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_pedidos_tipoPedido" AS ENUM (
    'LOCAL',
    'DELIVERY'
);


--
-- Name: enum_productos_categoria; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_productos_categoria AS ENUM (
    'plato_principal',
    'bebida',
    'postre'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cajas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cajas (
    "idCaja" integer NOT NULL,
    "montoInicial" double precision DEFAULT '0'::double precision NOT NULL,
    "montoFinal" double precision,
    estado public.enum_cajas_estado DEFAULT 'ABIERTA'::public.enum_cajas_estado,
    "fechaApertura" timestamp with time zone,
    "fechaCierre" timestamp with time zone
);


--
-- Name: cajas_idCaja_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."cajas_idCaja_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cajas_idCaja_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."cajas_idCaja_seq" OWNED BY public.cajas."idCaja";


--
-- Name: detalle_pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_pedidos (
    "idDetalle" integer NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    "precioUnitario" double precision NOT NULL,
    "subTotal" double precision NOT NULL,
    "idPedido" integer,
    "idProducto" integer
);


--
-- Name: detalle_pedidos_idDetalle_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."detalle_pedidos_idDetalle_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_pedidos_idDetalle_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."detalle_pedidos_idDetalle_seq" OWNED BY public.detalle_pedidos."idDetalle";


--
-- Name: funciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funciones (
    "funcionId" integer NOT NULL,
    nombre character varying(255) NOT NULL,
    detalle character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: funciones_funcionId_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."funciones_funcionId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: funciones_funcionId_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."funciones_funcionId_seq" OWNED BY public.funciones."funcionId";


--
-- Name: historial_accesos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial_accesos (
    "idHistorial" integer NOT NULL,
    metodo character varying(255) NOT NULL,
    "fechaHora" timestamp with time zone,
    ip character varying(255),
    "usuarioId" integer
);


--
-- Name: historial_accesos_idHistorial_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."historial_accesos_idHistorial_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historial_accesos_idHistorial_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."historial_accesos_idHistorial_seq" OWNED BY public.historial_accesos."idHistorial";


--
-- Name: mesas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mesas (
    "idMesa" integer NOT NULL,
    "numMesa" integer NOT NULL,
    capacidad integer DEFAULT 2 NOT NULL,
    estado public.enum_mesas_estado DEFAULT 'LIBRE'::public.enum_mesas_estado
);


--
-- Name: mesas_idMesa_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."mesas_idMesa_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mesas_idMesa_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."mesas_idMesa_seq" OWNED BY public.mesas."idMesa";


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    "idPago" integer NOT NULL,
    "metodoPago" public."enum_pagos_metodoPago" NOT NULL,
    monto double precision NOT NULL,
    "referenciaExterna" character varying(255),
    "fechaPago" timestamp with time zone,
    "idPedido" integer,
    "idCaja" integer
);


--
-- Name: pagos_idPago_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."pagos_idPago_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_idPago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."pagos_idPago_seq" OWNED BY public.pagos."idPago";


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos (
    "idPedido" integer NOT NULL,
    estado public.enum_pedidos_estado DEFAULT 'PENDIENTE'::public.enum_pedidos_estado,
    "tipoPedido" public."enum_pedidos_tipoPedido" DEFAULT 'LOCAL'::public."enum_pedidos_tipoPedido" NOT NULL,
    "fechaCreacion" timestamp with time zone,
    total double precision DEFAULT '0'::double precision,
    "idMesa" integer,
    "usuarioId" integer
);


--
-- Name: pedidos_idPedido_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."pedidos_idPedido_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedidos_idPedido_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."pedidos_idPedido_seq" OWNED BY public.pedidos."idPedido";


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    "idProducto" integer NOT NULL,
    nombre character varying(255) NOT NULL,
    descripcion character varying(255),
    "precioCosto" double precision,
    "porcentajeGanancia" double precision,
    precio double precision NOT NULL,
    "imagenUrl" character varying(255),
    categoria public.enum_productos_categoria NOT NULL
);


--
-- Name: productos_idProducto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."productos_idProducto_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_idProducto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."productos_idProducto_seq" OWNED BY public.productos."idProducto";


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    "rolId" integer NOT NULL,
    tipo character varying(255) NOT NULL,
    nombre character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: roles_funciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles_funciones (
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "funcionId" integer NOT NULL,
    "rolId" integer NOT NULL
);


--
-- Name: roles_rolId_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."roles_rolId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_rolId_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."roles_rolId_seq" OWNED BY public.roles."rolId";


--
-- Name: usuario_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_roles (
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "rolId" integer NOT NULL,
    "usuarioId" integer NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    "usuarioId" integer NOT NULL,
    apellido character varying(255) NOT NULL,
    nombre character varying(255) NOT NULL,
    dni character varying(255),
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: usuarios_usuarioId_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."usuarios_usuarioId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_usuarioId_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."usuarios_usuarioId_seq" OWNED BY public.usuarios."usuarioId";


--
-- Name: cajas idCaja; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas ALTER COLUMN "idCaja" SET DEFAULT nextval('public."cajas_idCaja_seq"'::regclass);


--
-- Name: detalle_pedidos idDetalle; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedidos ALTER COLUMN "idDetalle" SET DEFAULT nextval('public."detalle_pedidos_idDetalle_seq"'::regclass);


--
-- Name: funciones funcionId; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funciones ALTER COLUMN "funcionId" SET DEFAULT nextval('public."funciones_funcionId_seq"'::regclass);


--
-- Name: historial_accesos idHistorial; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_accesos ALTER COLUMN "idHistorial" SET DEFAULT nextval('public."historial_accesos_idHistorial_seq"'::regclass);


--
-- Name: mesas idMesa; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas ALTER COLUMN "idMesa" SET DEFAULT nextval('public."mesas_idMesa_seq"'::regclass);


--
-- Name: pagos idPago; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos ALTER COLUMN "idPago" SET DEFAULT nextval('public."pagos_idPago_seq"'::regclass);


--
-- Name: pedidos idPedido; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN "idPedido" SET DEFAULT nextval('public."pedidos_idPedido_seq"'::regclass);


--
-- Name: productos idProducto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN "idProducto" SET DEFAULT nextval('public."productos_idProducto_seq"'::regclass);


--
-- Name: roles rolId; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN "rolId" SET DEFAULT nextval('public."roles_rolId_seq"'::regclass);


--
-- Name: usuarios usuarioId; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN "usuarioId" SET DEFAULT nextval('public."usuarios_usuarioId_seq"'::regclass);


--
-- Name: cajas cajas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_pkey PRIMARY KEY ("idCaja");


--
-- Name: detalle_pedidos detalle_pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedidos
    ADD CONSTRAINT detalle_pedidos_pkey PRIMARY KEY ("idDetalle");


--
-- Name: funciones funciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funciones
    ADD CONSTRAINT funciones_pkey PRIMARY KEY ("funcionId");


--
-- Name: historial_accesos historial_accesos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_accesos
    ADD CONSTRAINT historial_accesos_pkey PRIMARY KEY ("idHistorial");


--
-- Name: mesas mesas_numMesa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT "mesas_numMesa_key" UNIQUE ("numMesa");


--
-- Name: mesas mesas_numMesa_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT "mesas_numMesa_key1" UNIQUE ("numMesa");


--
-- Name: mesas mesas_numMesa_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT "mesas_numMesa_key2" UNIQUE ("numMesa");


--
-- Name: mesas mesas_numMesa_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT "mesas_numMesa_key3" UNIQUE ("numMesa");


--
-- Name: mesas mesas_numMesa_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT "mesas_numMesa_key4" UNIQUE ("numMesa");


--
-- Name: mesas mesas_numMesa_key5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT "mesas_numMesa_key5" UNIQUE ("numMesa");


--
-- Name: mesas mesas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT mesas_pkey PRIMARY KEY ("idMesa");


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY ("idPago");


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY ("idPedido");


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY ("idProducto");


--
-- Name: roles_funciones roles_funciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_funciones
    ADD CONSTRAINT roles_funciones_pkey PRIMARY KEY ("funcionId", "rolId");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY ("rolId");


--
-- Name: usuario_roles usuario_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_roles
    ADD CONSTRAINT usuario_roles_pkey PRIMARY KEY ("rolId", "usuarioId");


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY ("usuarioId");


--
-- Name: historial_accesos_fecha_hora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX historial_accesos_fecha_hora ON public.historial_accesos USING btree ("fechaHora");


--
-- Name: detalle_pedidos detalle_pedidos_idPedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedidos
    ADD CONSTRAINT "detalle_pedidos_idPedido_fkey" FOREIGN KEY ("idPedido") REFERENCES public.pedidos("idPedido") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: detalle_pedidos detalle_pedidos_idProducto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedidos
    ADD CONSTRAINT "detalle_pedidos_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES public.productos("idProducto") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: historial_accesos historial_accesos_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_accesos
    ADD CONSTRAINT "historial_accesos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public.usuarios("usuarioId") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pagos pagos_idCaja_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT "pagos_idCaja_fkey" FOREIGN KEY ("idCaja") REFERENCES public.cajas("idCaja") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pagos pagos_idPedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT "pagos_idPedido_fkey" FOREIGN KEY ("idPedido") REFERENCES public.pedidos("idPedido") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pedidos pedidos_idMesa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT "pedidos_idMesa_fkey" FOREIGN KEY ("idMesa") REFERENCES public.mesas("idMesa") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pedidos pedidos_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT "pedidos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public.usuarios("usuarioId") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: roles_funciones roles_funciones_funcionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_funciones
    ADD CONSTRAINT "roles_funciones_funcionId_fkey" FOREIGN KEY ("funcionId") REFERENCES public.funciones("funcionId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: roles_funciones roles_funciones_rolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_funciones
    ADD CONSTRAINT "roles_funciones_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES public.roles("rolId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuario_roles usuario_roles_rolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_roles
    ADD CONSTRAINT "usuario_roles_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES public.roles("rolId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuario_roles usuario_roles_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_roles
    ADD CONSTRAINT "usuario_roles_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public.usuarios("usuarioId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict U7960itwlkoTBrRNEF0yVwBMKjNtYpY3ph2OPy3sR2mIsCKG1IdkKkUrpTGlsal

