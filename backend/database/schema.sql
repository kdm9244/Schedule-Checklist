--
-- PostgreSQL database dump
--

\restrict S2o3W8aR8Dug4jFcU6nGTF8i2aL3TZvZqJtxKZgkpadmPg6zlPy7xYb1GmO75Yc

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: learning_check_event_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.learning_check_event_owner() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM events WHERE event_id=NEW.event_id AND user_id=NEW.user_id AND NOT is_deleted
  ) THEN RAISE EXCEPTION 'Invalid calendar event owner' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;


--
-- Name: learning_check_period(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.learning_check_period() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE parent_start DATE; parent_end DATE;
BEGIN
  IF TG_TABLE_NAME = 'learning_milestones' THEN
    SELECT start_date,target_date INTO parent_start,parent_end FROM learning_roadmaps WHERE roadmap_id=NEW.roadmap_id AND user_id=NEW.user_id FOR UPDATE;
    IF NEW.start_date IS NULL OR NEW.due_date IS NULL OR parent_start IS NULL OR parent_end IS NULL OR NEW.start_date < parent_start OR NEW.due_date > parent_end THEN
      RAISE EXCEPTION 'Milestone outside roadmap period' USING ERRCODE='23514';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM learning_milestones WHERE roadmap_id=NEW.roadmap_id AND (start_date IS NULL OR due_date IS NULL OR NEW.start_date IS NULL OR NEW.target_date IS NULL OR start_date<NEW.start_date OR due_date>NEW.target_date)) THEN
      RAISE EXCEPTION 'Roadmap period excludes milestones' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: learning_preserve_records(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.learning_preserve_records() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'learning_milestones' THEN
    UPDATE learning_records SET milestone_id=NULL, task_id=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE user_id=OLD.user_id AND milestone_id=OLD.milestone_id;
  ELSE
    UPDATE learning_records SET task_id=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE user_id=OLD.user_id AND task_id=OLD.task_id;
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: sync_pdf_task_parent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_pdf_task_parent() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 UPDATE pdf_notes SET milestone_id=NEW.milestone_id,
 roadmap_id=(SELECT roadmap_id FROM learning_milestones WHERE milestone_id=NEW.milestone_id)
 WHERE task_id=NEW.task_id AND user_id=NEW.user_id;
 RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: checklist_template_skips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_template_skips (
    user_id bigint NOT NULL,
    template_id bigint NOT NULL,
    target_date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    template_id bigint NOT NULL,
    user_id bigint NOT NULL,
    title character varying(200) NOT NULL,
    days_of_week smallint[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    start_date date DEFAULT CURRENT_DATE NOT NULL
);


--
-- Name: checklist_templates_template_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklist_templates_template_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checklist_templates_template_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklist_templates_template_id_seq OWNED BY public.checklist_templates.template_id;


--
-- Name: checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklists (
    checklist_id bigint NOT NULL,
    user_id bigint NOT NULL,
    event_id character varying(512),
    title character varying(255) NOT NULL,
    target_date date NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    template_id bigint
);


--
-- Name: checklists_checklist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.checklists ALTER COLUMN checklist_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.checklists_checklist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: daily_memos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_memos (
    memo_id bigint NOT NULL,
    user_id bigint NOT NULL,
    memo_date date NOT NULL,
    content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: daily_memos_memo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.daily_memos ALTER COLUMN memo_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.daily_memos_memo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    event_id bigint NOT NULL,
    user_id bigint NOT NULL,
    google_event_id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    location character varying(255),
    start_datetime timestamp without time zone NOT NULL,
    end_datetime timestamp without time zone NOT NULL,
    is_all_day boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.events ALTER COLUMN event_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.events_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: learning_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_comments (
    comment_id bigint NOT NULL,
    user_id bigint NOT NULL,
    record_id bigint NOT NULL,
    block_start integer NOT NULL,
    block_source text NOT NULL,
    line_number integer NOT NULL,
    line_text text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_line integer NOT NULL,
    CONSTRAINT learning_comment_range CHECK (((end_line >= line_number) AND (end_line <= 200000))),
    CONSTRAINT learning_comments_block_source_check CHECK ((length(block_source) <= 200000)),
    CONSTRAINT learning_comments_block_start_check CHECK ((block_start >= 0)),
    CONSTRAINT learning_comments_body_check CHECK (((length(TRIM(BOTH FROM body)) > 0) AND (length(body) <= 10000))),
    CONSTRAINT learning_comments_line_number_check CHECK (((line_number >= 1) AND (line_number <= 200000))),
    CONSTRAINT learning_comments_line_text_check CHECK ((length(line_text) <= 200000))
);


--
-- Name: learning_comments_comment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_comments_comment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_comments_comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_comments_comment_id_seq OWNED BY public.learning_comments.comment_id;


--
-- Name: learning_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_milestones (
    milestone_id bigint NOT NULL,
    user_id bigint NOT NULL,
    roadmap_id bigint NOT NULL,
    title character varying(200) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    due_date date,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    start_date date,
    CONSTRAINT learning_milestone_period CHECK (((start_date IS NULL) OR (due_date IS NULL) OR (start_date <= due_date))),
    CONSTRAINT learning_milestones_sort_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT learning_milestones_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: learning_milestones_milestone_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_milestones_milestone_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_milestones_milestone_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_milestones_milestone_id_seq OWNED BY public.learning_milestones.milestone_id;


--
-- Name: learning_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_records (
    record_id bigint NOT NULL,
    user_id bigint NOT NULL,
    milestone_id bigint,
    task_id bigint,
    study_date date NOT NULL,
    title character varying(200) NOT NULL,
    body_markdown text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    input_mode text DEFAULT 'markdown'::text NOT NULL,
    CONSTRAINT learning_records_check CHECK (((task_id IS NULL) OR (milestone_id IS NOT NULL))),
    CONSTRAINT learning_records_input_mode_check CHECK ((input_mode = ANY (ARRAY['plain'::text, 'markdown'::text]))),
    CONSTRAINT learning_records_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: learning_records_record_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_records_record_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_records_record_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_records_record_id_seq OWNED BY public.learning_records.record_id;


--
-- Name: learning_roadmaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_roadmaps (
    roadmap_id bigint NOT NULL,
    user_id bigint NOT NULL,
    title character varying(200) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    target_date date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    start_date date,
    CONSTRAINT learning_roadmap_period CHECK (((start_date IS NULL) OR (target_date IS NULL) OR (start_date <= target_date))),
    CONSTRAINT learning_roadmaps_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: learning_roadmaps_roadmap_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_roadmaps_roadmap_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_roadmaps_roadmap_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_roadmaps_roadmap_id_seq OWNED BY public.learning_roadmaps.roadmap_id;


--
-- Name: learning_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_schedules (
    schedule_id bigint NOT NULL,
    user_id bigint NOT NULL,
    task_id bigint NOT NULL,
    event_id bigint,
    scheduled_date date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: learning_schedules_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_schedules_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_schedules_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_schedules_schedule_id_seq OWNED BY public.learning_schedules.schedule_id;


--
-- Name: learning_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_tasks (
    task_id bigint NOT NULL,
    user_id bigint NOT NULL,
    milestone_id bigint NOT NULL,
    title character varying(200) NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    start_date date,
    target_date date,
    CONSTRAINT learning_task_period CHECK (((start_date IS NULL) OR (target_date IS NULL) OR (start_date <= target_date))),
    CONSTRAINT learning_tasks_sort_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT learning_tasks_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: learning_tasks_task_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_tasks_task_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_tasks_task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_tasks_task_id_seq OWNED BY public.learning_tasks.task_id;


--
-- Name: pdf_note_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_note_entries (
    entry_id bigint NOT NULL,
    note_id bigint NOT NULL,
    question character varying(200) DEFAULT ''::character varying NOT NULL,
    page integer NOT NULL,
    interpretation text DEFAULT ''::text NOT NULL,
    solution text DEFAULT ''::text NOT NULL,
    review text DEFAULT ''::text NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    body_format character varying(10) DEFAULT 'plain'::character varying NOT NULL,
    CONSTRAINT pdf_note_entries_body_format_check CHECK (((body_format)::text = ANY ((ARRAY['plain'::character varying, 'richtext'::character varying])::text[]))),
    CONSTRAINT pdf_note_entries_page_check CHECK ((page > 0)),
    CONSTRAINT pdf_note_entries_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'done'::character varying, 'review'::character varying])::text[])))
);


--
-- Name: pdf_note_entries_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pdf_note_entries_entry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pdf_note_entries_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pdf_note_entries_entry_id_seq OWNED BY public.pdf_note_entries.entry_id;


--
-- Name: pdf_note_words; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_note_words (
    word_id bigint NOT NULL,
    note_id bigint NOT NULL,
    word character varying(200) NOT NULL,
    reading character varying(200) DEFAULT ''::character varying NOT NULL,
    meaning character varying(1000) NOT NULL,
    page integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mastered boolean DEFAULT false NOT NULL,
    CONSTRAINT pdf_note_words_meaning_check CHECK ((length(TRIM(BOTH FROM meaning)) > 0)),
    CONSTRAINT pdf_note_words_page_check CHECK (((page >= 1) AND (page <= 100000))),
    CONSTRAINT pdf_note_words_word_check CHECK ((length(TRIM(BOTH FROM word)) > 0))
);


--
-- Name: pdf_note_words_word_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pdf_note_words_word_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pdf_note_words_word_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pdf_note_words_word_id_seq OWNED BY public.pdf_note_words.word_id;


--
-- Name: pdf_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_notes (
    note_id bigint NOT NULL,
    user_id bigint NOT NULL,
    title character varying(200) NOT NULL,
    file_key uuid NOT NULL,
    file_size integer NOT NULL,
    roadmap_id bigint,
    milestone_id bigint,
    task_id bigint,
    last_page integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pdf_notes_file_size_check CHECK ((file_size > 0)),
    CONSTRAINT pdf_notes_last_page_check CHECK ((last_page > 0))
);


--
-- Name: pdf_notes_note_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pdf_notes_note_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pdf_notes_note_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pdf_notes_note_id_seq OWNED BY public.pdf_notes.note_id;


--
-- Name: user_calendar_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_calendar_preferences (
    user_id bigint NOT NULL,
    calendar_id text NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    google_id character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    user_name character varying(100) NOT NULL,
    profile_image text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN user_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: checklist_templates template_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates ALTER COLUMN template_id SET DEFAULT nextval('public.checklist_templates_template_id_seq'::regclass);


--
-- Name: learning_comments comment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_comments ALTER COLUMN comment_id SET DEFAULT nextval('public.learning_comments_comment_id_seq'::regclass);


--
-- Name: learning_milestones milestone_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_milestones ALTER COLUMN milestone_id SET DEFAULT nextval('public.learning_milestones_milestone_id_seq'::regclass);


--
-- Name: learning_records record_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_records ALTER COLUMN record_id SET DEFAULT nextval('public.learning_records_record_id_seq'::regclass);


--
-- Name: learning_roadmaps roadmap_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_roadmaps ALTER COLUMN roadmap_id SET DEFAULT nextval('public.learning_roadmaps_roadmap_id_seq'::regclass);


--
-- Name: learning_schedules schedule_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_schedules ALTER COLUMN schedule_id SET DEFAULT nextval('public.learning_schedules_schedule_id_seq'::regclass);


--
-- Name: learning_tasks task_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_tasks ALTER COLUMN task_id SET DEFAULT nextval('public.learning_tasks_task_id_seq'::regclass);


--
-- Name: pdf_note_entries entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_note_entries ALTER COLUMN entry_id SET DEFAULT nextval('public.pdf_note_entries_entry_id_seq'::regclass);


--
-- Name: pdf_note_words word_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_note_words ALTER COLUMN word_id SET DEFAULT nextval('public.pdf_note_words_word_id_seq'::regclass);


--
-- Name: pdf_notes note_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_notes ALTER COLUMN note_id SET DEFAULT nextval('public.pdf_notes_note_id_seq'::regclass);


--
-- Name: checklist_template_skips checklist_template_skips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_skips
    ADD CONSTRAINT checklist_template_skips_pkey PRIMARY KEY (user_id, template_id, target_date);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (template_id);


--
-- Name: checklists checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklists
    ADD CONSTRAINT checklists_pkey PRIMARY KEY (checklist_id);


--
-- Name: daily_memos daily_memos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_memos
    ADD CONSTRAINT daily_memos_pkey PRIMARY KEY (memo_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (event_id);


--
-- Name: learning_comments learning_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_comments
    ADD CONSTRAINT learning_comments_pkey PRIMARY KEY (comment_id);


--
-- Name: learning_milestones learning_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_milestones
    ADD CONSTRAINT learning_milestones_pkey PRIMARY KEY (milestone_id);


--
-- Name: learning_milestones learning_milestones_user_id_milestone_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_milestones
    ADD CONSTRAINT learning_milestones_user_id_milestone_id_key UNIQUE (user_id, milestone_id);


--
-- Name: learning_records learning_record_owner_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_records
    ADD CONSTRAINT learning_record_owner_unique UNIQUE (user_id, record_id);


--
-- Name: learning_records learning_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_records
    ADD CONSTRAINT learning_records_pkey PRIMARY KEY (record_id);


--
-- Name: learning_roadmaps learning_roadmaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_roadmaps
    ADD CONSTRAINT learning_roadmaps_pkey PRIMARY KEY (roadmap_id);


--
-- Name: learning_roadmaps learning_roadmaps_user_id_roadmap_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_roadmaps
    ADD CONSTRAINT learning_roadmaps_user_id_roadmap_id_key UNIQUE (user_id, roadmap_id);


--
-- Name: learning_schedules learning_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_schedules
    ADD CONSTRAINT learning_schedules_pkey PRIMARY KEY (schedule_id);


--
-- Name: learning_tasks learning_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_tasks
    ADD CONSTRAINT learning_tasks_pkey PRIMARY KEY (task_id);


--
-- Name: learning_tasks learning_tasks_user_id_milestone_id_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_tasks
    ADD CONSTRAINT learning_tasks_user_id_milestone_id_task_id_key UNIQUE (user_id, milestone_id, task_id);


--
-- Name: learning_tasks learning_tasks_user_id_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_tasks
    ADD CONSTRAINT learning_tasks_user_id_task_id_key UNIQUE (user_id, task_id);


--
-- Name: pdf_note_entries pdf_note_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_note_entries
    ADD CONSTRAINT pdf_note_entries_pkey PRIMARY KEY (entry_id);


--
-- Name: pdf_note_words pdf_note_words_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_note_words
    ADD CONSTRAINT pdf_note_words_pkey PRIMARY KEY (word_id);


--
-- Name: pdf_notes pdf_notes_file_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_notes
    ADD CONSTRAINT pdf_notes_file_key_key UNIQUE (file_key);


--
-- Name: pdf_notes pdf_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_notes
    ADD CONSTRAINT pdf_notes_pkey PRIMARY KEY (note_id);


--
-- Name: daily_memos uq_daily_memo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_memos
    ADD CONSTRAINT uq_daily_memo UNIQUE (user_id, memo_date);


--
-- Name: events uq_events_google; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT uq_events_google UNIQUE (user_id, google_event_id);


--
-- Name: user_calendar_preferences user_calendar_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_calendar_preferences
    ADD CONSTRAINT user_calendar_preferences_pkey PRIMARY KEY (user_id, calendar_id);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: idx_checklists_user_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklists_user_event ON public.checklists USING btree (user_id, event_id) WHERE (event_id IS NOT NULL);


--
-- Name: idx_learning_comment_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_comment_record ON public.learning_comments USING btree (user_id, record_id, comment_id);


--
-- Name: idx_learning_milestone_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_milestone_due ON public.learning_milestones USING btree (user_id, due_date);


--
-- Name: idx_learning_milestone_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_milestone_order ON public.learning_milestones USING btree (user_id, roadmap_id, sort_order, milestone_id);


--
-- Name: idx_learning_record_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_record_date ON public.learning_records USING btree (user_id, study_date DESC, record_id DESC);


--
-- Name: idx_learning_record_milestone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_record_milestone ON public.learning_records USING btree (user_id, milestone_id, study_date DESC);


--
-- Name: idx_learning_record_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_record_task ON public.learning_records USING btree (user_id, task_id) WHERE (task_id IS NOT NULL);


--
-- Name: idx_learning_schedule_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_schedule_date ON public.learning_schedules USING btree (user_id, scheduled_date, schedule_id);


--
-- Name: idx_learning_schedule_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_schedule_event ON public.learning_schedules USING btree (event_id) WHERE (event_id IS NOT NULL);


--
-- Name: idx_learning_schedule_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_schedule_task ON public.learning_schedules USING btree (user_id, task_id);


--
-- Name: idx_learning_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_task_order ON public.learning_tasks USING btree (user_id, milestone_id, sort_order, task_id);


--
-- Name: pdf_entries_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pdf_entries_note ON public.pdf_note_entries USING btree (note_id, page, entry_id);


--
-- Name: pdf_notes_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pdf_notes_owner ON public.pdf_notes USING btree (user_id);


--
-- Name: pdf_words_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pdf_words_note ON public.pdf_note_words USING btree (note_id, word_id);


--
-- Name: uq_checklists_template_day; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_checklists_template_day ON public.checklists USING btree (user_id, target_date, template_id) WHERE (template_id IS NOT NULL);


--
-- Name: learning_milestones learning_milestone_period_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_milestone_period_guard BEFORE INSERT OR UPDATE OF start_date, due_date, roadmap_id ON public.learning_milestones FOR EACH ROW EXECUTE FUNCTION public.learning_check_period();


--
-- Name: learning_milestones learning_milestone_preserve; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_milestone_preserve BEFORE DELETE ON public.learning_milestones FOR EACH ROW EXECUTE FUNCTION public.learning_preserve_records();


--
-- Name: learning_roadmaps learning_roadmap_period_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_roadmap_period_guard BEFORE UPDATE OF start_date, target_date ON public.learning_roadmaps FOR EACH ROW EXECUTE FUNCTION public.learning_check_period();


--
-- Name: learning_schedules learning_schedule_event_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_schedule_event_owner BEFORE INSERT OR UPDATE ON public.learning_schedules FOR EACH ROW EXECUTE FUNCTION public.learning_check_event_owner();


--
-- Name: learning_tasks learning_task_preserve; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_task_preserve BEFORE DELETE ON public.learning_tasks FOR EACH ROW EXECUTE FUNCTION public.learning_preserve_records();


--
-- Name: learning_tasks pdf_task_parent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pdf_task_parent AFTER UPDATE OF milestone_id ON public.learning_tasks FOR EACH ROW WHEN ((old.milestone_id IS DISTINCT FROM new.milestone_id)) EXECUTE FUNCTION public.sync_pdf_task_parent();


--
-- Name: checklists fk_checklists_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklists
    ADD CONSTRAINT fk_checklists_user FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: daily_memos fk_daily_memos_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_memos
    ADD CONSTRAINT fk_daily_memos_user FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: events fk_events_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT fk_events_user FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: learning_comments learning_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_comments
    ADD CONSTRAINT learning_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: learning_comments learning_comments_user_id_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_comments
    ADD CONSTRAINT learning_comments_user_id_record_id_fkey FOREIGN KEY (user_id, record_id) REFERENCES public.learning_records(user_id, record_id) ON DELETE CASCADE;


--
-- Name: learning_milestones learning_milestones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_milestones
    ADD CONSTRAINT learning_milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: learning_milestones learning_milestones_user_id_roadmap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_milestones
    ADD CONSTRAINT learning_milestones_user_id_roadmap_id_fkey FOREIGN KEY (user_id, roadmap_id) REFERENCES public.learning_roadmaps(user_id, roadmap_id) ON DELETE CASCADE;


--
-- Name: learning_records learning_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_records
    ADD CONSTRAINT learning_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: learning_records learning_records_user_id_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_records
    ADD CONSTRAINT learning_records_user_id_milestone_id_fkey FOREIGN KEY (user_id, milestone_id) REFERENCES public.learning_milestones(user_id, milestone_id);


--
-- Name: learning_records learning_records_user_id_milestone_id_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_records
    ADD CONSTRAINT learning_records_user_id_milestone_id_task_id_fkey FOREIGN KEY (user_id, milestone_id, task_id) REFERENCES public.learning_tasks(user_id, milestone_id, task_id) DEFERRABLE;


--
-- Name: learning_roadmaps learning_roadmaps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_roadmaps
    ADD CONSTRAINT learning_roadmaps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: learning_schedules learning_schedules_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_schedules
    ADD CONSTRAINT learning_schedules_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(event_id) ON DELETE SET NULL;


--
-- Name: learning_schedules learning_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_schedules
    ADD CONSTRAINT learning_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: learning_schedules learning_schedules_user_id_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_schedules
    ADD CONSTRAINT learning_schedules_user_id_task_id_fkey FOREIGN KEY (user_id, task_id) REFERENCES public.learning_tasks(user_id, task_id) ON DELETE CASCADE;


--
-- Name: learning_tasks learning_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_tasks
    ADD CONSTRAINT learning_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: learning_tasks learning_tasks_user_id_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_tasks
    ADD CONSTRAINT learning_tasks_user_id_milestone_id_fkey FOREIGN KEY (user_id, milestone_id) REFERENCES public.learning_milestones(user_id, milestone_id) ON DELETE CASCADE;


--
-- Name: pdf_note_entries pdf_note_entries_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_note_entries
    ADD CONSTRAINT pdf_note_entries_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.pdf_notes(note_id) ON DELETE CASCADE;


--
-- Name: pdf_note_words pdf_note_words_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_note_words
    ADD CONSTRAINT pdf_note_words_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.pdf_notes(note_id) ON DELETE CASCADE;


--
-- Name: pdf_notes pdf_notes_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_notes
    ADD CONSTRAINT pdf_notes_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.learning_milestones(milestone_id) ON DELETE SET NULL;


--
-- Name: pdf_notes pdf_notes_roadmap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_notes
    ADD CONSTRAINT pdf_notes_roadmap_id_fkey FOREIGN KEY (roadmap_id) REFERENCES public.learning_roadmaps(roadmap_id) ON DELETE SET NULL;


--
-- Name: pdf_notes pdf_notes_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_notes
    ADD CONSTRAINT pdf_notes_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.learning_tasks(task_id) ON DELETE SET NULL;


--
-- Name: pdf_notes pdf_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_notes
    ADD CONSTRAINT pdf_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict S2o3W8aR8Dug4jFcU6nGTF8i2aL3TZvZqJtxKZgkpadmPg6zlPy7xYb1GmO75Yc

