--
-- PostgreSQL database dump
--

\restrict KuYswD17DbXoytBCEHtwtpVnc4hVVxAVSwGgYFla7DG92WZj1tynVe1MhV2iqjN

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

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
-- Name: auth_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_credentials (
    actor_id text NOT NULL,
    password_hash text NOT NULL,
    password_salt text NOT NULL,
    password_iterations integer NOT NULL,
    password_digest text DEFAULT 'sha256'::text NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    password_changed_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auth_credentials_iterations_ck CHECK ((password_iterations >= 100000))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    migration_id text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    checksum_sha256 text NOT NULL,
    description text NOT NULL
);


--
-- Name: auth_credentials auth_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_credentials
    ADD CONSTRAINT auth_credentials_pkey PRIMARY KEY (actor_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (migration_id);


--
-- Name: idx_auth_credentials_locked_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_credentials_locked_until ON public.auth_credentials USING btree (locked_until) WHERE (locked_until IS NOT NULL);


--
-- Name: auth_credentials auth_credentials_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_credentials
    ADD CONSTRAINT auth_credentials_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.staff_actors(actor_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict KuYswD17DbXoytBCEHtwtpVnc4hVVxAVSwGgYFla7DG92WZj1tynVe1MhV2iqjN

