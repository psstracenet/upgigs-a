--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: gigs; Type: TABLE; Schema: public; Owner: joeb
--

CREATE TABLE public.gigs (
    id integer NOT NULL,
    date date NOT NULL,
    venue text NOT NULL,
    city text NOT NULL,
    "time" text NOT NULL
);


ALTER TABLE public.gigs OWNER TO joeb;

--
-- Name: gigs_id_seq; Type: SEQUENCE; Schema: public; Owner: joeb
--

CREATE SEQUENCE public.gigs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.gigs_id_seq OWNER TO joeb;

--
-- Name: gigs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: joeb
--

ALTER SEQUENCE public.gigs_id_seq OWNED BY public.gigs.id;


--
-- Name: gigs id; Type: DEFAULT; Schema: public; Owner: joeb
--

ALTER TABLE ONLY public.gigs ALTER COLUMN id SET DEFAULT nextval('public.gigs_id_seq'::regclass);


--
-- Data for Name: gigs; Type: TABLE DATA; Schema: public; Owner: joeb
--

COPY public.gigs (id, date, venue, city, "time") FROM stdin;
1	2025-04-25	The Basement	Nashville, TN	8:00 PM
2	2025-05-02	The Fillmore	San Francisco, CA	9:30 PM
3	2025-06-15	The Cat's Cradle	Carrboro, NC	8:30 PM
4	2025-05-12	The Cobra Club	Brooklyn, NY	8:00 PM
5	2023-06-10	The Troubadour	Los Angeles	9:00 PM
6	2023-05-31	Mantzys	Hickory	8:00 PM
7	2025-05-03	The Pour House	Raleigh	8:00 PM
9	2025-05-20	Tracei	LA	8:00 PM
10	2025-05-03	The Pour House	Raleigh	8:00 pm
8	2025-05-20	The Money	LA	8:00 PM
\.


--
-- Name: gigs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: joeb
--

SELECT pg_catalog.setval('public.gigs_id_seq', 10, true);


--
-- Name: gigs gigs_pkey; Type: CONSTRAINT; Schema: public; Owner: joeb
--

ALTER TABLE ONLY public.gigs
    ADD CONSTRAINT gigs_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

