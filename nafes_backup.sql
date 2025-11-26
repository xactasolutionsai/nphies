--
-- PostgreSQL database dump
--

\restrict 0UXwZ1S4M0lWgadxv2epV209heKGkqhYYqZpu5uFy8w9KfzAjxodij0mdVcDaad

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

-- Started on 2025-10-11 18:43:57

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 24577)
-- Name: authorizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.authorizations (
    auth_id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_status character varying(50),
    purpose text,
    patient_id uuid,
    provider_id uuid,
    insurer_id uuid,
    amount numeric(10,2),
    request_date date
);


ALTER TABLE public.authorizations OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 24584)
-- Name: claims; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.claims (
    claim_id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_number character varying(255),
    patient_id uuid,
    provider_id uuid,
    insurer_id uuid,
    status character varying(50),
    amount numeric(10,2),
    submission_date date,
    batch_id uuid
);


ALTER TABLE public.claims OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 24589)
-- Name: claims_batch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.claims_batch (
    batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_date date,
    number_of_claims integer,
    status character varying(50),
    total_amount numeric(10,2),
    provider_id uuid,
    insurer_id uuid
);


ALTER TABLE public.claims_batch OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 24594)
-- Name: eligibility; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.eligibility (
    eligibility_id uuid DEFAULT gen_random_uuid() NOT NULL,
    purpose text,
    patient_id uuid,
    provider_id uuid,
    insurer_id uuid,
    status character varying(50),
    coverage character varying(50),
    request_date date
);


ALTER TABLE public.eligibility OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 24601)
-- Name: insurers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurers (
    insurer_id uuid DEFAULT gen_random_uuid() NOT NULL,
    insurer_name character varying(255) NOT NULL,
    nphies_id character varying(255),
    status character varying(50),
    contact_person character varying(255),
    phone character varying(50)
);


ALTER TABLE public.insurers OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 24609)
-- Name: medical_exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medical_exams (
    exam_name character varying(255) NOT NULL,
    prerequisites character varying(255)
);


ALTER TABLE public.medical_exams OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 24615)
-- Name: patients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patients (
    patient_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    identifier character varying(255),
    gender character varying(50),
    birth_date date,
    phone character varying(50)
);


ALTER TABLE public.patients OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 24623)
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_ref character varying(255),
    insurer_id uuid,
    provider_id uuid,
    amount numeric(10,2),
    status character varying(50),
    payment_date date
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 24628)
-- Name: providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.providers (
    provider_id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_name character varying(255) NOT NULL,
    type character varying(100),
    nphies_id character varying(255),
    address text,
    phone character varying(50)
);


ALTER TABLE public.providers OWNER TO postgres;

--
-- TOC entry 5084 (class 0 OID 24577)
-- Dependencies: 219
-- Data for Name: authorizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.authorizations (auth_id, auth_status, purpose, patient_id, provider_id, insurer_id, amount, request_date) FROM stdin;
f39bed35-07d9-484c-b507-17e68c702ce0	Approved	Heart Valve Replacement	bbbe2465-5afc-4ea7-8ecb-e5bff384897e	76c2734f-b436-49fe-a645-03669dc804ed	69912bb9-020e-42ac-839b-adb11efc18c0	50000.00	2025-08-01
4205734d-eafb-45c4-8439-bfe2533e99e6	Denied	Cosmetic Surgery	78f6af5a-000f-43ff-970b-6468dc1aa749	b76cf7f9-d7b0-4582-a281-8b5d7b640986	0f691a03-8538-4e04-86d9-ce890693f558	15000.00	2025-08-05
54e92d79-a4b6-4696-b3b8-54a86a6b8a54	Pending	Specialty Drug X	082ee8c7-9bf2-4a88-b918-09e565709029	094b3c3d-1920-4a0f-945e-ee0bf94f60c5	d55831df-f9f6-4cbc-9176-d30d5577ff74	8000.00	2025-08-10
9e11d395-15e5-4b76-8ca5-f5145f9ad03a	Partial Approval	Multiple Imaging Tests	52c7b86a-fd43-4a37-ab7e-acffd068991f	b4ea317c-fb81-4957-afa6-5c8ad0c397ac	69912bb9-020e-42ac-839b-adb11efc18c0	4500.00	2025-08-15
14faf07e-fe4b-4a18-9472-a032dd6e0606	Approved	Maternity Delivery	fe12db5d-149e-42db-86fd-b4bc2f579549	76c2734f-b436-49fe-a645-03669dc804ed	fac7369c-d0a1-4355-84e8-c62f8f953e10	12000.00	2025-08-20
17443b95-ce7c-4679-baf8-d8f702fad859	Denied	Experimental Treatment Z	e2f1c01e-42c6-452b-84ac-f18834ae0be1	b76cf7f9-d7b0-4582-a281-8b5d7b640986	5d6004c0-193e-47d3-8683-e178aecfc0bc	22000.00	2025-08-25
2791a2ec-6e4e-46a1-8245-1f9728bf3a03	Cancelled	Physical Therapy Sessions	f49e6348-4475-4359-8ca0-bddee2b21d70	094b3c3d-1920-4a0f-945e-ee0bf94f60c5	0f691a03-8538-4e04-86d9-ce890693f558	3000.00	2025-09-01
360c486d-143a-42df-a6fe-7979d6f86dc0	Expired	Joint Replacement	e7296a28-41b5-4514-94a5-e3e83877391e	b4ea317c-fb81-4957-afa6-5c8ad0c397ac	d55831df-f9f6-4cbc-9176-d30d5577ff74	45000.00	2024-11-01
f428e376-c0a7-462d-8049-efda976cdb5b	Pending	Extended Hospital Stay	44129872-1b50-4203-8877-b72f4aaa1268	76c2734f-b436-49fe-a645-03669dc804ed	69912bb9-020e-42ac-839b-adb11efc18c0	18000.00	2025-09-10
b708cd60-7173-48f4-bc2f-3f1705939049	Approved	Emergency Transport	960027aa-bd10-473b-8ff8-476eb1e51a27	b76cf7f9-d7b0-4582-a281-8b5d7b640986	0f691a03-8538-4e04-86d9-ce890693f558	1200.00	2025-09-15
\.


--
-- TOC entry 5085 (class 0 OID 24584)
-- Dependencies: 220
-- Data for Name: claims; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.claims (claim_id, claim_number, patient_id, provider_id, insurer_id, status, amount, submission_date, batch_id) FROM stdin;
15cc0595-83a4-4ec7-9d39-55a85c8fc741	C-001-APP	bbbe2465-5afc-4ea7-8ecb-e5bff384897e	76c2734f-b436-49fe-a645-03669dc804ed	69912bb9-020e-42ac-839b-adb11efc18c0	Approved	1200.50	2025-09-01	7aab34b6-3ecf-4c92-a19a-18be79a3f95a
fba540d9-e38e-48b1-ab90-fb70da3bfab7	C-002-DEN	78f6af5a-000f-43ff-970b-6468dc1aa749	b76cf7f9-d7b0-4582-a281-8b5d7b640986	0f691a03-8538-4e04-86d9-ce890693f558	Denied	950.00	2025-09-02	7aab34b6-3ecf-4c92-a19a-18be79a3f95a
15f85e60-5936-48aa-bfd7-0e6cbb0a04d0	C-003-UR	082ee8c7-9bf2-4a88-b918-09e565709029	76c2734f-b436-49fe-a645-03669dc804ed	d55831df-f9f6-4cbc-9176-d30d5577ff74	Under Review	5000.00	2025-09-03	7aab34b6-3ecf-4c92-a19a-18be79a3f95a
63e9209a-7b0f-4935-ac9e-65609d108a39	C-004-PART	52c7b86a-fd43-4a37-ab7e-acffd068991f	094b3c3d-1920-4a0f-945e-ee0bf94f60c5	69912bb9-020e-42ac-839b-adb11efc18c0	Paid	300.00	2025-09-04	7aab34b6-3ecf-4c92-a19a-18be79a3f95a
f487d16b-d865-403d-9487-807646a9ef33	C-005-REJ	e2f1c01e-42c6-452b-84ac-f18834ae0be1	b4ea317c-fb81-4957-afa6-5c8ad0c397ac	58f6fada-f24c-46ca-9a5d-49071d0bc392	Rejected	750.00	2025-09-05	\N
0fc0aeee-02f7-4064-97bd-3693d370b1a1	C-006-RESUB	fe12db5d-149e-42db-86fd-b4bc2f579549	76c2734f-b436-49fe-a645-03669dc804ed	fac7369c-d0a1-4355-84e8-c62f8f953e10	Resubmitted	1500.00	2025-09-06	7aab34b6-3ecf-4c92-a19a-18be79a3f95a
eb95e068-ae6b-4b39-99d1-17d89b43caaf	C-007-ROUT	f49e6348-4475-4359-8ca0-bddee2b21d70	b76cf7f9-d7b0-4582-a281-8b5d7b640986	5d6004c0-193e-47d3-8683-e178aecfc0bc	Approved	450.00	2025-09-07	7aab34b6-3ecf-4c92-a19a-18be79a3f95a
0d3e889a-147a-4bc3-8980-a4ec0173b460	C-008-NCOV	e7296a28-41b5-4514-94a5-e3e83877391e	094b3c3d-1920-4a0f-945e-ee0bf94f60c5	0f691a03-8538-4e04-86d9-ce890693f558	Denied	800.00	2025-09-08	7aab34b6-3ecf-4c92-a19a-18be79a3f95a
650e71b9-8323-424c-becd-370b5d5df113	C-009-ADMIN	44129872-1b50-4203-8877-b72f4aaa1268	b4ea317c-fb81-4957-afa6-5c8ad0c397ac	d55831df-f9f6-4cbc-9176-d30d5577ff74	Finalized	0.00	2025-09-09	7aab34b6-3ecf-4c92-a19a-18be79a3f95a
5131dd09-d98b-4d66-8a72-d4000ac754ea	C-010-PEND	960027aa-bd10-473b-8ff8-476eb1e51a27	76c2734f-b436-49fe-a645-03669dc804ed	69912bb9-020e-42ac-839b-adb11efc18c0	Pending	4600.00	2025-09-10	\N
\.


--
-- TOC entry 5086 (class 0 OID 24589)
-- Dependencies: 221
-- Data for Name: claims_batch; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.claims_batch (batch_id, submission_date, number_of_claims, status, total_amount, provider_id, insurer_id) FROM stdin;
7aab34b6-3ecf-4c92-a19a-18be79a3f95a	2025-09-01	10	Finalized	15550.00	76c2734f-b436-49fe-a645-03669dc804ed	69912bb9-020e-42ac-839b-adb11efc18c0
\.


--
-- TOC entry 5087 (class 0 OID 24594)
-- Dependencies: 222
-- Data for Name: eligibility; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.eligibility (eligibility_id, purpose, patient_id, provider_id, insurer_id, status, coverage, request_date) FROM stdin;
b5e9bd10-decc-4cad-8f1a-9dfa0ca118a7	validation	bbbe2465-5afc-4ea7-8ecb-e5bff384897e	76c2734f-b436-49fe-a645-03669dc804ed	69912bb9-020e-42ac-839b-adb11efc18c0	Active	Full	2025-09-01
9cf5d363-fab1-4024-b805-d84feaf8261a	benefits	78f6af5a-000f-43ff-970b-6468dc1aa749	b76cf7f9-d7b0-4582-a281-8b5d7b640986	0f691a03-8538-4e04-86d9-ce890693f558	Active	Limited	2025-09-02
d4ec4567-671e-45db-9a05-c227e7d36afe	validation	082ee8c7-9bf2-4a88-b918-09e565709029	094b3c3d-1920-4a0f-945e-ee0bf94f60c5	d55831df-f9f6-4cbc-9176-d30d5577ff74	Inactive	None	2025-09-03
1679739e-ad50-44fc-90f6-094239529ba5	validation	52c7b86a-fd43-4a37-ab7e-acffd068991f	b4ea317c-fb81-4957-afa6-5c8ad0c397ac	58f6fada-f24c-46ca-9a5d-49071d0bc392	Suspended	None	2025-09-04
5f7e6ccc-74ad-4300-9131-e0720b24ac0c	benefits	e2f1c01e-42c6-452b-84ac-f18834ae0be1	76c2734f-b436-49fe-a645-03669dc804ed	fac7369c-d0a1-4355-84e8-c62f8f953e10	Active	Max Benefit Reached	2025-09-05
5520fe52-d396-46c3-bc83-f785f409ecfd	validation	fe12db5d-149e-42db-86fd-b4bc2f579549	b76cf7f9-d7b0-4582-a281-8b5d7b640986	5d6004c0-193e-47d3-8683-e178aecfc0bc	Pending	Unknown	2025-09-06
afabcfb1-5532-4edc-9629-629d4dbd8d76	benefits	f49e6348-4475-4359-8ca0-bddee2b21d70	094b3c3d-1920-4a0f-945e-ee0bf94f60c5	0f691a03-8538-4e04-86d9-ce890693f558	Active	Co-Pay Required	2025-09-07
fa447ba1-8caa-48ea-824d-cdea8d8c628a	validation	e7296a28-41b5-4514-94a5-e3e83877391e	b4ea317c-fb81-4957-afa6-5c8ad0c397ac	d55831df-f9f6-4cbc-9176-d30d5577ff74	Active	Emergency Only	2025-09-08
067cb889-6286-41e8-9b01-06ffaabb8f6c	benefits	44129872-1b50-4203-8877-b72f4aaa1268	76c2734f-b436-49fe-a645-03669dc804ed	69912bb9-020e-42ac-839b-adb11efc18c0	Active	Referral Required	2025-09-09
\.


--
-- TOC entry 5088 (class 0 OID 24601)
-- Dependencies: 223
-- Data for Name: insurers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurers (insurer_id, insurer_name, nphies_id, status, contact_person, phone) FROM stdin;
69912bb9-020e-42ac-839b-adb11efc18c0	Bupa Arabia	80001	Active	Mr. Abdullah Al-Malki	+966501111000
0f691a03-8538-4e04-86d9-ce890693f558	Tawuniya	80002	Active	Ms. Sara Al-Hassan	+966552222000
d55831df-f9f6-4cbc-9176-d30d5577ff74	MedGulf	80003	Active	Claims Department	+966503333000
58f6fada-f24c-46ca-9a5d-49071d0bc392	AXA Cooperative	80004	Suspended	Mr. Omar Al-Rajhi	+966554444000
fac7369c-d0a1-4355-84e8-c62f8f953e10	Walaa Cooperative	80005	Active	Client Services	+966505555000
5d6004c0-193e-47d3-8683-e178aecfc0bc	Saudi Health Alliance	80006	Active	Eng. Nora	+966556666000
\.


--
-- TOC entry 5089 (class 0 OID 24609)
-- Dependencies: 224
-- Data for Name: medical_exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.medical_exams (exam_name, prerequisites) FROM stdin;
MRI	X-Ray
CT	Renal Function Test
Echocardiogram	EKG
General Checkup	\N
Renal Function Test	\N
X-Ray	\N
Angiogram	CT
Endoscopy	Fasting Requirement
Coagulation Panel	\N
Biopsy	Coagulation Panel
\.


--
-- TOC entry 5090 (class 0 OID 24615)
-- Dependencies: 225
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.patients (patient_id, name, identifier, gender, birth_date, phone) FROM stdin;
bbbe2465-5afc-4ea7-8ecb-e5bff384897e	Ahmed Al-Ghamdi	1234567890	male	1985-03-25	050-111-2222
78f6af5a-000f-43ff-970b-6468dc1aa749	Fatima Al-Otaibi	9876543210	female	1990-08-10	050-222-3333
082ee8c7-9bf2-4a88-b918-09e565709029	Khaled Al-Harbi	1122334455	male	1975-11-01	050-333-4444
52c7b86a-fd43-4a37-ab7e-acffd068991f	Sara Al-Ali	2233445566	female	2001-04-18	050-444-5555
e2f1c01e-42c6-452b-84ac-f18834ae0be1	Omar Bakr	3344556677	male	1965-01-20	050-555-6666
fe12db5d-149e-42db-86fd-b4bc2f579549	Noora Al-Shalan	4455667788	female	1998-07-07	050-666-7777
f49e6348-4475-4359-8ca0-bddee2b21d70	Abdullah Zahrani	5566778899	male	2010-12-12	050-777-8888
e7296a28-41b5-4514-94a5-e3e83877391e	Lama Turki	6677889900	female	1988-05-30	050-888-9999
44129872-1b50-4203-8877-b72f4aaa1268	Majed Tamer	7788990011	male	1995-02-14	050-000-1111
960027aa-bd10-473b-8ff8-476eb1e51a27	Amal Salem	8899001122	female	1970-09-23	050-101-2020
\.


--
-- TOC entry 5091 (class 0 OID 24623)
-- Dependencies: 226
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (payment_id, payment_ref, insurer_id, provider_id, amount, status, payment_date) FROM stdin;
16325590-a4d1-4700-b01f-ece8161cdf35	PAY-12345	69912bb9-020e-42ac-839b-adb11efc18c0	76c2734f-b436-49fe-a645-03669dc804ed	1200.50	Paid	2025-09-15
c5bb888b-b880-4e00-8cd7-f2f22639c51c	PAY-12346	69912bb9-020e-42ac-839b-adb11efc18c0	094b3c3d-1920-4a0f-945e-ee0bf94f60c5	300.00	Paid	2025-09-16
\.


--
-- TOC entry 5092 (class 0 OID 24628)
-- Dependencies: 227
-- Data for Name: providers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.providers (provider_id, provider_name, type, nphies_id, address, phone) FROM stdin;
76c2734f-b436-49fe-a645-03669dc804ed	King Faisal Specialist Hospital	Hospital	90001	Riyadh Main Campus	011-222-1111
b76cf7f9-d7b0-4582-a281-8b5d7b640986	Dallah Hospital	Hospital	90002	Dallah District, Riyadh	011-333-2222
094b3c3d-1920-4a0f-945e-ee0bf94f60c5	Al-Mashari Clinic	Clinic	90003	King Fahd Road, Jeddah	012-444-3333
b4ea317c-fb81-4957-afa6-5c8ad0c397ac	Jeddah Medical Center	Medical Center	90004	Prince Sultan Street, Jeddah	012-555-4444
\.


--
-- TOC entry 4896 (class 2606 OID 24637)
-- Name: authorizations authorizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_pkey PRIMARY KEY (auth_id);


--
-- TOC entry 4902 (class 2606 OID 24639)
-- Name: claims_batch claims_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims_batch
    ADD CONSTRAINT claims_batch_pkey PRIMARY KEY (batch_id);


--
-- TOC entry 4898 (class 2606 OID 24641)
-- Name: claims claims_claim_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_claim_number_key UNIQUE (claim_number);


--
-- TOC entry 4900 (class 2606 OID 24643)
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (claim_id);


--
-- TOC entry 4904 (class 2606 OID 24645)
-- Name: eligibility eligibility_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eligibility
    ADD CONSTRAINT eligibility_pkey PRIMARY KEY (eligibility_id);


--
-- TOC entry 4906 (class 2606 OID 24647)
-- Name: insurers insurers_nphies_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurers
    ADD CONSTRAINT insurers_nphies_id_key UNIQUE (nphies_id);


--
-- TOC entry 4908 (class 2606 OID 24649)
-- Name: insurers insurers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurers
    ADD CONSTRAINT insurers_pkey PRIMARY KEY (insurer_id);


--
-- TOC entry 4910 (class 2606 OID 24651)
-- Name: medical_exams medical_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_exams
    ADD CONSTRAINT medical_exams_pkey PRIMARY KEY (exam_name);


--
-- TOC entry 4912 (class 2606 OID 24653)
-- Name: patients patients_identifier_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_identifier_key UNIQUE (identifier);


--
-- TOC entry 4914 (class 2606 OID 24655)
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (patient_id);


--
-- TOC entry 4916 (class 2606 OID 24657)
-- Name: payments payments_payment_ref_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_ref_key UNIQUE (payment_ref);


--
-- TOC entry 4918 (class 2606 OID 24659)
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);


--
-- TOC entry 4920 (class 2606 OID 24661)
-- Name: providers providers_nphies_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_nphies_id_key UNIQUE (nphies_id);


--
-- TOC entry 4922 (class 2606 OID 24663)
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (provider_id);


--
-- TOC entry 4923 (class 2606 OID 24664)
-- Name: authorizations authorizations_insurer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES public.insurers(insurer_id);


--
-- TOC entry 4924 (class 2606 OID 24669)
-- Name: authorizations authorizations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- TOC entry 4925 (class 2606 OID 24674)
-- Name: authorizations authorizations_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(provider_id);


--
-- TOC entry 4926 (class 2606 OID 24679)
-- Name: claims claims_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.claims_batch(batch_id);


--
-- TOC entry 4930 (class 2606 OID 24684)
-- Name: claims_batch claims_batch_insurer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims_batch
    ADD CONSTRAINT claims_batch_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES public.insurers(insurer_id);


--
-- TOC entry 4931 (class 2606 OID 24689)
-- Name: claims_batch claims_batch_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims_batch
    ADD CONSTRAINT claims_batch_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(provider_id);


--
-- TOC entry 4927 (class 2606 OID 24694)
-- Name: claims claims_insurer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES public.insurers(insurer_id);


--
-- TOC entry 4928 (class 2606 OID 24699)
-- Name: claims claims_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- TOC entry 4929 (class 2606 OID 24704)
-- Name: claims claims_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(provider_id);


--
-- TOC entry 4932 (class 2606 OID 24709)
-- Name: eligibility eligibility_insurer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eligibility
    ADD CONSTRAINT eligibility_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES public.insurers(insurer_id);


--
-- TOC entry 4933 (class 2606 OID 24714)
-- Name: eligibility eligibility_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eligibility
    ADD CONSTRAINT eligibility_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- TOC entry 4934 (class 2606 OID 24719)
-- Name: eligibility eligibility_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eligibility
    ADD CONSTRAINT eligibility_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(provider_id);


--
-- TOC entry 4935 (class 2606 OID 24724)
-- Name: payments payments_insurer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES public.insurers(insurer_id);


--
-- TOC entry 4936 (class 2606 OID 24729)
-- Name: payments payments_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(provider_id);


-- Completed on 2025-10-11 18:43:57

--
-- PostgreSQL database dump complete
--

\unrestrict 0UXwZ1S4M0lWgadxv2epV209heKGkqhYYqZpu5uFy8w9KfzAjxodij0mdVcDaad

