--
-- PostgreSQL database dump
--

\restrict 8czUICbYiZbS8559LD4UDt8MOwcJPTSyZmnv1z517DuOSe5Cx5UDO6k90iHqf7E

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

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_analysis_audit; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.ai_analysis_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id text NOT NULL,
    engine_id text NOT NULL,
    subject_id text,
    risk_class text NOT NULL,
    result_status text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ai_analysis_audit OWNER TO taman_v743_dev;

--
-- Name: care_action_audit; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.care_action_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_sequence bigint NOT NULL,
    care_action_id uuid NOT NULL,
    resident_id text NOT NULL,
    pattern_id text NOT NULL,
    event_type text NOT NULL,
    actor_id text,
    actor_role text,
    previous_state jsonb,
    new_state jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.care_action_audit OWNER TO taman_v743_dev;

--
-- Name: care_action_audit_event_sequence_seq; Type: SEQUENCE; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE public.care_action_audit ALTER COLUMN event_sequence ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.care_action_audit_event_sequence_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: care_action_transfers; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.care_action_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_sequence bigint NOT NULL,
    care_action_id uuid NOT NULL,
    event_type text NOT NULL,
    from_assigned_to text,
    from_assigned_role text,
    to_assigned_to text NOT NULL,
    to_assigned_role text NOT NULL,
    priority text,
    due_at timestamp with time zone,
    transferred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id text,
    actor_role text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT care_action_transfers_event_type_check CHECK ((event_type = ANY (ARRAY['ASSIGNMENT'::text, 'TRANSFER'::text]))),
    CONSTRAINT care_action_transfers_priority_check CHECK (((priority IS NULL) OR (priority = ANY (ARRAY['HIGH'::text, 'MODERATE'::text, 'LOW'::text]))))
);


ALTER TABLE public.care_action_transfers OWNER TO taman_v743_dev;

--
-- Name: care_action_transfers_event_sequence_seq; Type: SEQUENCE; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE public.care_action_transfers ALTER COLUMN event_sequence ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.care_action_transfers_event_sequence_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: care_actions; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.care_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resident_id text NOT NULL,
    pattern_id text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    assigned_to text,
    assigned_role text,
    assigned_at timestamp with time zone,
    priority text,
    due_at timestamp with time zone,
    review_started_at timestamp with time zone,
    resolved_at timestamp with time zone,
    resolution_reason text,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT care_actions_assignment_consistency CHECK ((((assigned_to IS NULL) AND (assigned_role IS NULL) AND (assigned_at IS NULL)) OR ((assigned_to IS NOT NULL) AND (assigned_role IS NOT NULL) AND (assigned_at IS NOT NULL)))),
    CONSTRAINT care_actions_priority_check CHECK (((priority IS NULL) OR (priority = ANY (ARRAY['HIGH'::text, 'MODERATE'::text, 'LOW'::text])))),
    CONSTRAINT care_actions_resolution_consistency CHECK (((status <> 'RESOLVED'::text) OR (resolved_at IS NOT NULL))),
    CONSTRAINT care_actions_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'IN_REVIEW'::text, 'RESOLVED'::text])))
);


ALTER TABLE public.care_actions OWNER TO taman_v743_dev;

--
-- Name: care_plan_audit; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.care_plan_audit (
    audit_id text NOT NULL,
    event_sequence bigint NOT NULL,
    care_plan_id text NOT NULL,
    resident_id text NOT NULL,
    event_type text NOT NULL,
    actor_id text,
    actor_role text,
    previous_state jsonb,
    new_state jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT care_plan_audit_event_type_check CHECK ((event_type = ANY (ARRAY['PLAN_CREATED'::text, 'PLAN_ACTIVATED'::text, 'PLAN_SUSPENDED'::text, 'PLAN_REACTIVATED'::text, 'PLAN_COMPLETED'::text, 'PLAN_CANCELLED'::text, 'PLAN_UPDATED'::text])))
);


ALTER TABLE public.care_plan_audit OWNER TO taman_v743_dev;

--
-- Name: care_plans; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.care_plans (
    care_plan_id text NOT NULL,
    resident_id text NOT NULL,
    plan_code text NOT NULL,
    title text NOT NULL,
    description text,
    status text NOT NULL,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone,
    created_by text NOT NULL,
    created_by_role text NOT NULL,
    approved_by text,
    approved_by_role text,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT care_plans_check CHECK (((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT care_plans_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'COMPLETED'::text, 'CANCELLED'::text])))
);


ALTER TABLE public.care_plans OWNER TO taman_v743_dev;

--
-- Name: care_task_audit; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.care_task_audit (
    audit_id text NOT NULL,
    event_sequence bigint NOT NULL,
    care_task_id text NOT NULL,
    care_plan_id text NOT NULL,
    resident_id text NOT NULL,
    event_type text NOT NULL,
    actor_id text,
    actor_role text,
    previous_state jsonb,
    new_state jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT care_task_audit_event_type_check CHECK ((event_type = ANY (ARRAY['TASK_CREATED'::text, 'TASK_ASSIGNED'::text, 'TASK_REASSIGNED'::text, 'TASK_STARTED'::text, 'TASK_COMPLETED'::text, 'TASK_MISSED'::text, 'TASK_SKIPPED'::text, 'TASK_CANCELLED'::text])))
);


ALTER TABLE public.care_task_audit OWNER TO taman_v743_dev;

--
-- Name: care_tasks; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.care_tasks (
    care_task_id text NOT NULL,
    care_plan_id text NOT NULL,
    resident_id text NOT NULL,
    task_code text NOT NULL,
    title text NOT NULL,
    description text,
    task_category text NOT NULL,
    status text NOT NULL,
    priority text NOT NULL,
    scheduled_at timestamp with time zone,
    due_at timestamp with time zone,
    recurrence_rule text,
    assigned_to text,
    assigned_role text,
    assigned_at timestamp with time zone,
    accepted_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    missed_at timestamp with time zone,
    skipped_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    completion_note text,
    exception_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT care_tasks_check CHECK (((due_at IS NULL) OR (scheduled_at IS NULL) OR (due_at >= scheduled_at))),
    CONSTRAINT care_tasks_check1 CHECK ((((assigned_to IS NULL) AND (assigned_role IS NULL) AND (assigned_at IS NULL)) OR ((assigned_to IS NOT NULL) AND (assigned_role IS NOT NULL) AND (assigned_at IS NOT NULL)))),
    CONSTRAINT care_tasks_priority_check CHECK ((priority = ANY (ARRAY['LOW'::text, 'MODERATE'::text, 'HIGH'::text]))),
    CONSTRAINT care_tasks_status_check CHECK ((status = ANY (ARRAY['PLANNED'::text, 'ASSIGNED'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'MISSED'::text, 'SKIPPED'::text, 'CANCELLED'::text])))
);


ALTER TABLE public.care_tasks OWNER TO taman_v743_dev;

--
-- Name: residents; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.residents (
    resident_id text NOT NULL,
    resident_code text NOT NULL,
    display_name text NOT NULL,
    date_of_birth date NOT NULL,
    gender text NOT NULL,
    room text,
    bed text,
    care_level text NOT NULL,
    active_status boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT residents_care_level_check CHECK ((care_level = ANY (ARRAY['INDEPENDENT'::text, 'ASSISTED'::text, 'HIGH_ASSISTANCE'::text, 'DEPENDENT'::text]))),
    CONSTRAINT residents_gender_check CHECK ((gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text, 'OTHER'::text, 'UNSPECIFIED'::text])))
);


ALTER TABLE public.residents OWNER TO taman_v743_dev;

--
-- Name: warning_reviews; Type: TABLE; Schema: public; Owner: taman_v743_dev
--

CREATE TABLE public.warning_reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL,
    warning_id text NOT NULL,
    resident_id text NOT NULL,
    decision text NOT NULL,
    reviewer_id text NOT NULL,
    reviewer_role text NOT NULL,
    care_note text,
    reviewed_at timestamp with time zone DEFAULT now() NOT NULL,
    pattern_id text NOT NULL,
    CONSTRAINT warning_reviews_decision_check CHECK ((decision = ANY (ARRAY['NO_ACTION_REQUIRED'::text, 'MONITOR'::text, 'CREATE_CARE_ACTION'::text, 'ESCALATE'::text])))
);


ALTER TABLE public.warning_reviews OWNER TO taman_v743_dev;

--
-- Name: ai_analysis_audit ai_analysis_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.ai_analysis_audit
    ADD CONSTRAINT ai_analysis_audit_pkey PRIMARY KEY (id);


--
-- Name: care_action_audit care_action_audit_event_sequence_key; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_action_audit
    ADD CONSTRAINT care_action_audit_event_sequence_key UNIQUE (event_sequence);


--
-- Name: care_action_audit care_action_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_action_audit
    ADD CONSTRAINT care_action_audit_pkey PRIMARY KEY (id);


--
-- Name: care_action_transfers care_action_transfers_event_sequence_key; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_action_transfers
    ADD CONSTRAINT care_action_transfers_event_sequence_key UNIQUE (event_sequence);


--
-- Name: care_action_transfers care_action_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_action_transfers
    ADD CONSTRAINT care_action_transfers_pkey PRIMARY KEY (id);


--
-- Name: care_actions care_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_actions
    ADD CONSTRAINT care_actions_pkey PRIMARY KEY (id);


--
-- Name: care_actions care_actions_resident_pattern_unique; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_actions
    ADD CONSTRAINT care_actions_resident_pattern_unique UNIQUE (resident_id, pattern_id);


--
-- Name: care_plan_audit care_plan_audit_care_plan_id_event_sequence_key; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_plan_audit
    ADD CONSTRAINT care_plan_audit_care_plan_id_event_sequence_key UNIQUE (care_plan_id, event_sequence);


--
-- Name: care_plan_audit care_plan_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_plan_audit
    ADD CONSTRAINT care_plan_audit_pkey PRIMARY KEY (audit_id);


--
-- Name: care_plans care_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_pkey PRIMARY KEY (care_plan_id);


--
-- Name: care_plans care_plans_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_plan_code_key UNIQUE (plan_code);


--
-- Name: care_task_audit care_task_audit_care_task_id_event_sequence_key; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_task_audit
    ADD CONSTRAINT care_task_audit_care_task_id_event_sequence_key UNIQUE (care_task_id, event_sequence);


--
-- Name: care_task_audit care_task_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_task_audit
    ADD CONSTRAINT care_task_audit_pkey PRIMARY KEY (audit_id);


--
-- Name: care_tasks care_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_tasks
    ADD CONSTRAINT care_tasks_pkey PRIMARY KEY (care_task_id);


--
-- Name: care_tasks care_tasks_task_code_key; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_tasks
    ADD CONSTRAINT care_tasks_task_code_key UNIQUE (task_code);


--
-- Name: residents residents_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.residents
    ADD CONSTRAINT residents_pkey PRIMARY KEY (resident_id);


--
-- Name: residents residents_resident_code_key; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.residents
    ADD CONSTRAINT residents_resident_code_key UNIQUE (resident_code);


--
-- Name: warning_reviews warning_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.warning_reviews
    ADD CONSTRAINT warning_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: warning_reviews warning_reviews_warning_id_key; Type: CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.warning_reviews
    ADD CONSTRAINT warning_reviews_warning_id_key UNIQUE (warning_id);


--
-- Name: idx_care_action_audit_action; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_action_audit_action ON public.care_action_audit USING btree (care_action_id, created_at);


--
-- Name: idx_care_action_audit_resident; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_action_audit_resident ON public.care_action_audit USING btree (resident_id, created_at);


--
-- Name: idx_care_action_transfers_action; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_action_transfers_action ON public.care_action_transfers USING btree (care_action_id, transferred_at);


--
-- Name: idx_care_actions_due_at; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_actions_due_at ON public.care_actions USING btree (due_at) WHERE (due_at IS NOT NULL);


--
-- Name: idx_care_actions_priority; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_actions_priority ON public.care_actions USING btree (priority);


--
-- Name: idx_care_actions_resident; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_actions_resident ON public.care_actions USING btree (resident_id);


--
-- Name: idx_care_actions_status; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_actions_status ON public.care_actions USING btree (status);


--
-- Name: idx_care_plan_audit_plan_sequence; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_plan_audit_plan_sequence ON public.care_plan_audit USING btree (care_plan_id, event_sequence);


--
-- Name: idx_care_plans_resident; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_plans_resident ON public.care_plans USING btree (resident_id);


--
-- Name: idx_care_plans_resident_status; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_plans_resident_status ON public.care_plans USING btree (resident_id, status);


--
-- Name: idx_care_task_audit_task_sequence; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_task_audit_task_sequence ON public.care_task_audit USING btree (care_task_id, event_sequence);


--
-- Name: idx_care_tasks_assigned_to_status; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_tasks_assigned_to_status ON public.care_tasks USING btree (assigned_to, status);


--
-- Name: idx_care_tasks_due_at; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_tasks_due_at ON public.care_tasks USING btree (due_at);


--
-- Name: idx_care_tasks_plan; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_tasks_plan ON public.care_tasks USING btree (care_plan_id);


--
-- Name: idx_care_tasks_resident; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_tasks_resident ON public.care_tasks USING btree (resident_id);


--
-- Name: idx_care_tasks_resident_status_due; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_tasks_resident_status_due ON public.care_tasks USING btree (resident_id, status, due_at);


--
-- Name: idx_care_tasks_status; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_care_tasks_status ON public.care_tasks USING btree (status);


--
-- Name: idx_residents_active_status; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_residents_active_status ON public.residents USING btree (active_status);


--
-- Name: idx_residents_room_bed; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_residents_room_bed ON public.residents USING btree (room, bed);


--
-- Name: idx_warning_reviews_decision; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_warning_reviews_decision ON public.warning_reviews USING btree (decision, reviewed_at);


--
-- Name: idx_warning_reviews_resident; Type: INDEX; Schema: public; Owner: taman_v743_dev
--

CREATE INDEX idx_warning_reviews_resident ON public.warning_reviews USING btree (resident_id, reviewed_at);


--
-- Name: care_action_audit care_action_audit_care_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_action_audit
    ADD CONSTRAINT care_action_audit_care_action_id_fkey FOREIGN KEY (care_action_id) REFERENCES public.care_actions(id) ON DELETE CASCADE;


--
-- Name: care_action_transfers care_action_transfers_care_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_action_transfers
    ADD CONSTRAINT care_action_transfers_care_action_id_fkey FOREIGN KEY (care_action_id) REFERENCES public.care_actions(id) ON DELETE CASCADE;


--
-- Name: care_plan_audit care_plan_audit_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_plan_audit
    ADD CONSTRAINT care_plan_audit_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(care_plan_id);


--
-- Name: care_plan_audit care_plan_audit_resident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_plan_audit
    ADD CONSTRAINT care_plan_audit_resident_id_fkey FOREIGN KEY (resident_id) REFERENCES public.residents(resident_id);


--
-- Name: care_plans care_plans_resident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_resident_id_fkey FOREIGN KEY (resident_id) REFERENCES public.residents(resident_id);


--
-- Name: care_task_audit care_task_audit_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_task_audit
    ADD CONSTRAINT care_task_audit_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(care_plan_id);


--
-- Name: care_task_audit care_task_audit_care_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_task_audit
    ADD CONSTRAINT care_task_audit_care_task_id_fkey FOREIGN KEY (care_task_id) REFERENCES public.care_tasks(care_task_id);


--
-- Name: care_task_audit care_task_audit_resident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_task_audit
    ADD CONSTRAINT care_task_audit_resident_id_fkey FOREIGN KEY (resident_id) REFERENCES public.residents(resident_id);


--
-- Name: care_tasks care_tasks_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_tasks
    ADD CONSTRAINT care_tasks_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(care_plan_id);


--
-- Name: care_tasks care_tasks_resident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.care_tasks
    ADD CONSTRAINT care_tasks_resident_id_fkey FOREIGN KEY (resident_id) REFERENCES public.residents(resident_id);


--
-- Name: warning_reviews warning_reviews_resident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: taman_v743_dev
--

ALTER TABLE ONLY public.warning_reviews
    ADD CONSTRAINT warning_reviews_resident_id_fkey FOREIGN KEY (resident_id) REFERENCES public.residents(resident_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 8czUICbYiZbS8559LD4UDt8MOwcJPTSyZmnv1z517DuOSe5Cx5UDO6k90iHqf7E

