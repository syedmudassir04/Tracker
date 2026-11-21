-- 2026-11-21: curated source list. Run AFTER 0002_site_type migration.
-- Idempotent: updates matching names, retains existing ID/check history/applications.

DROP TABLE IF EXISTS _tracker_seed;
CREATE TABLE _tracker_seed(name TEXT PRIMARY KEY, career_url TEXT NOT NULL, linkedin_url TEXT NOT NULL, site_type TEXT NOT NULL, notes TEXT NOT NULL, seed_id TEXT NOT NULL);

DROP TABLE IF EXISTS _tracker_alias;
CREATE TABLE _tracker_alias(alias TEXT PRIMARY KEY, name TEXT NOT NULL);

INSERT INTO _tracker_seed VALUES ('TRC Companies, Inc. (TRC)', 'https://careers.trccompanies.com/jobs', '', 'Company Website', '', '316862f7-8578-4eae-8bec-58c08111911f');

INSERT INTO _tracker_seed VALUES ('Ayr Energy', 'https://ats.rippling.com/ayr-careers/jobs', '', 'Company Website', '', '544248d7-cd30-4a77-8a29-27dbd7d22950');

INSERT INTO _tracker_seed VALUES ('Syneos Health', 'https://syneoshealth.wd12.myworkdayjobs.com/Syneos_Health_External_Site', '', 'Company Website', '', '21496a24-f1d0-4205-b2e0-cd1b2214a775');

INSERT INTO _tracker_seed VALUES ('Southwest Airlines', 'https://careers.southwestair.com/in/en/search-results', '', 'Company Website', '', '2018d3a2-3362-4136-b6df-17a5d62a8a4c');

INSERT INTO _tracker_seed VALUES ('Corner Stone Technology Services (CS TechServ)', 'https://www.cstechserv.com/careers.php', '', 'Company Website', '', '5da58457-37b7-4e31-937f-8ca9deb7c808');

INSERT INTO _tracker_seed VALUES ('Bondada Group (Bondada Engineering)', 'https://www.bondada.net/careers/job-opportunities', '', 'Company Website', '', '9159ee43-e39e-4e08-9ac3-0ca1494fd681');

INSERT INTO _tracker_seed VALUES ('Qnity Electronics (Qnity)', 'https://careers.qnityelectronics.com/us/en/', '', 'Company Website', 'Electronics company; not the unrelated qnity.com consulting business.', '89a0c7bd-9045-42e5-9e16-af5ff6759d67');

INSERT INTO _tracker_seed VALUES ('Protolabs', 'https://www.protolabs.com/about-us/careers/', '', 'Company Website', '', 'dcb78d9c-1fda-42aa-af34-2efea56dace2');

INSERT INTO _tracker_seed VALUES ('GlobalLogic', 'https://www.globallogic.com/in/career-search-page/', '', 'Company Website', '', 'acd374f9-3d77-4f12-a265-128e9a2edc17');

INSERT INTO _tracker_seed VALUES ('TTEC Holdings (TTEC)', 'https://www.ttecjobs.com/en/location/hyderabad-telangana-india-jobs/44028/1269750-1254788-1269843/4', '', 'Company Website', '', '14ae6490-43c7-4274-b042-ca8644369743');

INSERT INTO _tracker_seed VALUES ('Cimpress', 'https://cimpress.com/careers/', '', 'Company Website', '', '7a9b7fbb-4aca-412b-9dcd-8f821c215c62');

INSERT INTO _tracker_seed VALUES ('Curvion Blue', 'https://jobs.ashbyhq.com/curvionblue', '', 'Company Website', 'Hyderabad presence not independently confirmed.', '39d83632-b70d-40de-afb1-aee496c80b7d');

INSERT INTO _tracker_seed VALUES ('Marsh McLennan (Marsh)', 'https://careers.marsh.com/global/en/search-results', '', 'Company Website', '', 'e8da482a-c43d-4800-88e4-591133f66a00');

INSERT INTO _tracker_seed VALUES ('Rubixe', 'https://rubixe.com/job-openings', '', 'Company Website', '', '96ca760d-249e-42f2-858e-6934b1bbf01c');

INSERT INTO _tracker_seed VALUES ('Algoleap Technologies', 'https://careers.algoleap.com/', '', 'Company Website', '', 'b090d524-55f5-4503-aa09-58ec38d49ba0');

INSERT INTO _tracker_seed VALUES ('Bristol Myers Squibb (BMS)', 'https://app.eightfold.ai/careers?domain=bms.com&location=hyderabad', '', 'Company Website', '', '69d50ff8-7d03-4dce-bfb4-c04dbcbfaf62');

INSERT INTO _tracker_seed VALUES ('Google', 'https://www.google.com/about/careers/applications/jobs/results/', '', 'Company Website', '', '685c980e-eed5-4b9f-b09b-733a97bb7463');

INSERT INTO _tracker_seed VALUES ('Amazon', 'https://www.amazon.jobs/en/search?base_query=data&loc_query=Hyderabad%2C%20Telangana%2C%20India', '', 'Company Website', '', '6b4e7551-4258-43fd-93ae-5b33a75452ea');

INSERT INTO _tracker_seed VALUES ('Deloitte', 'https://usijobs.deloitte.com/en_US/careersUSI', '', 'Company Website', 'Also check India portal: https://southasiacareers.deloitte.com/go/Deloitte-India/718244/', '803415ac-d56b-4410-b691-9b78da96b41a');

INSERT INTO _tracker_seed VALUES ('Applause', 'https://www.applause.com/job-opportunities/', '', 'Company Website', '', 'dcc4da52-366a-47aa-9f90-925a56de2209');

INSERT INTO _tracker_seed VALUES ('Argano', 'https://fa-eyau-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Argano-Careers/jobs', '', 'Company Website', '', '1d13f23a-cbf9-4b00-9f10-66bc57ac9f68');

INSERT INTO _tracker_seed VALUES ('Equinix', 'https://careers.equinix.com/', '', 'Company Website', '', '5c744e1b-2c71-453e-9fae-f848e08e5989');

INSERT INTO _tracker_seed VALUES ('Databeat', 'https://databeat.keka.com/careers/', '', 'Company Website', '', '0ed8e2fb-7ac7-4a7a-a431-7646cecd17c5');

INSERT INTO _tracker_seed VALUES ('GlobalData Plc (GlobalData)', 'https://careers.globaldata.com/vacancies', '', 'Company Website', '', '0048ef3d-1d98-4144-8b3c-a5d9a3d2f55f');

INSERT INTO _tracker_seed VALUES ('JPMorgan Chase & Co. (JPMC)', 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/', '', 'Company Website', '', 'b51b680d-2e43-46c7-9f65-14486d15d0da');

INSERT INTO _tracker_seed VALUES ('Goldman Sachs (GS)', 'https://higher.gs.com/results?page=1&sort=RELEVANCE', '', 'Company Website', '', '275b47f8-ab3b-4fa3-b6db-791919cdf7e6');

INSERT INTO _tracker_seed VALUES ('Loyalty Juggernaut (LJI)', 'https://lji.bamboohr.com/careers', '', 'Company Website', '', '62f45898-7c19-4de5-b909-d4157ba5e7d6');

INSERT INTO _tracker_seed VALUES ('Roche', 'https://careers.roche.com/global/en/', '', 'Company Website', '', 'dfc39dc5-d5bc-457a-b0b7-2d29aa59b467');

INSERT INTO _tracker_seed VALUES ('Cohere Health', 'https://www.coherehealth.com/careers', '', 'Company Website', '', '7fecec90-fa74-4368-9b6f-29086c43e575');

INSERT INTO _tracker_seed VALUES ('Astika Software Limited', 'https://www.astika.in/careers', '', 'Company Website', '', '74ecacd8-126b-44ef-aae8-906d9fdb5407');

INSERT INTO _tracker_seed VALUES ('Anblicks', 'https://anblicks.keka.com/careers/', '', 'Company Website', '', 'c1b8c76a-8100-47d3-9ce4-8d7ef83d1b85');

INSERT INTO _tracker_seed VALUES ('PepsiCo', 'https://globalcareers-pepsico.icims.com/jobs/search?ss=1', '', 'Company Website', '', 'b53014bd-aa19-4255-a123-86eb1f04ee39');

INSERT INTO _tracker_seed VALUES ('IntouchCX', 'https://jobs.dayforcehcm.com/en-CA/intouchcx/CANDIDATEPORTAL/jobs', '', 'Company Website', '', '5b9f7cab-766c-46cc-b74f-7c1a5c5d9bb7');

INSERT INTO _tracker_seed VALUES ('UnitedHealth Group (UHG)', 'https://careers.unitedhealthgroup.com/search-jobs/data/Hyderabad%2C%20Telangana/34088/1/4/1269750-1254788-1269844-1269843/17x384050369262695/78x45635986328125/50/2', '', 'Company Website', '', 'adb0f80b-bb94-414d-9ef2-72b1e3497c79');

INSERT INTO _tracker_seed VALUES ('Crowe LLP (Crowe)', 'https://careers.crowe.com/search-results', '', 'Company Website', '', 'bbc538a6-406d-4476-824f-0b4507ea641a');

INSERT INTO _tracker_seed VALUES ('Accenture', 'https://www.accenture.com/in-en/careers/jobsearch?ct=Hyderabad&jk=data', 'https://www.linkedin.com/company/accenture/jobs/', 'Company Website', '', 'dff7d187-60cf-4496-ba78-1462a815b69f');

INSERT INTO _tracker_seed VALUES ('TriNet', 'https://jobs.trinet.com/careers', '', 'Company Website', 'Also official Oracle-hosted portal: https://fa-etgw-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs', '5b88b5f6-4341-4f22-950b-d2fae8355ed1');

INSERT INTO _tracker_seed VALUES ('Franklin Templeton', 'https://careers.franklintempleton.com/us/en/search-results', '', 'Company Website', '', '88b052fb-c37e-49a3-9eb8-eb10e6f67a0c');

INSERT INTO _tracker_seed VALUES ('Cognizant', 'https://careers.cognizant.com/', 'https://www.linkedin.com/company/cognizant/jobs/', 'Company Website', '', '2ef84dd1-5a46-4ae7-8aa3-a368d2779979');

INSERT INTO _tracker_seed VALUES ('Wipro', 'https://careers.wipro.com/', 'https://www.linkedin.com/company/wipro/jobs/', 'Company Website', '', '85f74ef9-9dd9-4fcb-9a4f-fae1d1ea81cc');

INSERT INTO _tracker_seed VALUES ('HCLTech (HCL Technologies)', 'https://www.hcltech.com/careers', 'https://www.linkedin.com/company/hcltech/jobs/', 'Company Website', '', '34cf231f-823d-43cf-94a9-5eb01c89b339');

INSERT INTO _tracker_seed VALUES ('Capgemini', 'https://www.capgemini.com/careers/', 'https://www.linkedin.com/company/capgemini/jobs/', 'Company Website', '', 'f98ad431-7fe6-4116-8cef-8ee7b4ec9e46');

INSERT INTO _tracker_seed VALUES ('LTIMindtree', 'https://www.ltimindtree.com/careers/', 'https://www.linkedin.com/company/ltimindtree/jobs/', 'Company Website', '', 'fd73e1a3-545c-45b7-b810-e21059708e4e');

INSERT INTO _tracker_seed VALUES ('Tech Mahindra', 'https://careers.techmahindra.com/', 'https://www.linkedin.com/company/tech-mahindra/jobs/', 'Company Website', '', 'e15c60cd-6e75-4a1e-b753-7b2456d40a52');

INSERT INTO _tracker_seed VALUES ('Oracle Corporation', 'https://careers.oracle.com/en/sites/jobsearch/jobs', 'https://www.linkedin.com/company/oracle/jobs/', 'Company Website', '', 'c4cf065c-8103-43bb-bdb8-54f62857b076');

INSERT INTO _tracker_seed VALUES ('Salesforce', 'https://careers.salesforce.com/en/jobs/', 'https://www.linkedin.com/company/salesforce/jobs/', 'Company Website', '', '510ba855-0ece-4f87-91b9-d79e9019d5bd');

INSERT INTO _tracker_seed VALUES ('ServiceNow', 'https://careers.servicenow.com/jobs/', 'https://www.linkedin.com/company/servicenow/jobs/', 'Company Website', '', '747b21a4-e8dc-4d1c-9c46-ceb898ec4d0f');

INSERT INTO _tracker_seed VALUES ('SAP SE (SAP)', 'https://jobs.sap.com/en/jobs/', 'https://www.linkedin.com/company/sap/jobs/', 'Company Website', '', '8a16ef0d-1b42-480e-a1b9-17e303cd8dcc');

INSERT INTO _tracker_seed VALUES ('International Business Machines (IBM)', 'https://www.ibm.com/careers', 'https://www.linkedin.com/company/ibm/jobs/', 'Company Website', '', '9826893f-fbcd-48cd-891d-f6120c8b5f35');

INSERT INTO _tracker_seed VALUES ('Workday', 'https://www.workday.com/en-us/company/careers.html', 'https://www.linkedin.com/company/workday/jobs/', 'Company Website', '', 'd6635bdd-9617-48b1-a0ee-2a5580d12e83');

INSERT INTO _tracker_seed VALUES ('Red Hat', 'https://www.redhat.com/en/jobs', 'https://www.linkedin.com/company/red-hat/jobs/', 'Company Website', '', '105489da-1a47-4250-9627-ad1e467a5d25');

INSERT INTO _tracker_seed VALUES ('Intel Corporation', 'https://jobs.intel.com/', 'https://www.linkedin.com/company/intel-corporation/jobs/', 'Company Website', '', '17b8a053-7664-4d1e-a54a-3889c1ac7ef3');

INSERT INTO _tracker_seed VALUES ('Advanced Micro Devices (AMD)', 'https://careers.amd.com/careers-home/jobs/', 'https://www.linkedin.com/company/amd/jobs/', 'Company Website', '', '1298968e-4900-4668-b469-fe36e27c26e4');

INSERT INTO _tracker_seed VALUES ('Qualcomm', 'https://careers.qualcomm.com/', 'https://www.linkedin.com/company/qualcomm/jobs/', 'Company Website', '', '3512ccaf-52a3-4dae-8149-573845f177e8');

INSERT INTO _tracker_seed VALUES ('Cisco Systems (Cisco)', 'https://jobs.cisco.com/', 'https://www.linkedin.com/company/cisco/jobs/', 'Company Website', '', '89e1e526-ccc2-4853-9759-c7ca5ceed749');

INSERT INTO _tracker_seed VALUES ('Dell Technologies', 'https://jobs.dell.com/', 'https://www.linkedin.com/company/delltechnologies/jobs/', 'Company Website', '', '38b02bd3-ed28-4162-8684-90bf4c3a33e9');

INSERT INTO _tracker_seed VALUES ('Atlassian', 'https://www.atlassian.com/company/careers', 'https://www.linkedin.com/company/atlassian/jobs/', 'Company Website', '', '47d8188b-b746-44a3-a4f2-13b00ad609f1');

INSERT INTO _tracker_seed VALUES ('Zoho Corporation', 'https://www.zoho.com/careers/', 'https://www.linkedin.com/company/zoho/jobs/', 'Company Website', '', '7a38a71e-d7fa-4654-985d-df0b925cf7f7');

INSERT INTO _tracker_seed VALUES ('Snowflake', 'https://careers.snowflake.com/', 'https://www.linkedin.com/company/snowflake-computing/jobs/', 'Company Website', '', 'c546e776-4aac-434a-af6c-7d9d5c0f08c4');

INSERT INTO _tracker_seed VALUES ('Datadog', 'https://careers.datadoghq.com/', 'https://www.linkedin.com/company/datadog/jobs/', 'Company Website', '', 'bc921c24-3bab-40e4-bc8a-4b6e549c17d8');

INSERT INTO _tracker_seed VALUES ('BrowserStack', 'https://www.browserstack.com/careers', 'https://www.linkedin.com/company/browserstack/jobs/', 'Company Website', '', 'a236f72e-468a-4050-ab54-ac90ddc64b06');

INSERT INTO _tracker_seed VALUES ('Appinventiv', 'https://appinventiv.com/career/', '', 'Company Website', '', 'c1cd1ef8-8c46-4bce-9427-f6aa01830477');

INSERT INTO _tracker_seed VALUES ('Talent500', 'https://talent500.com/joblist/?search_term=data+analyst&experience_range=0-1+years&location=Hyderabad', '', 'Career Website', 'Third-party job discovery platform.', 'f0bc3bf4-961c-4742-ab20-5ec4b3cfc8ce');

INSERT INTO _tracker_seed VALUES ('Shine', 'https://www.shine.com/', '', 'Career Website', 'Third-party job discovery platform.', '1b151a9e-c865-4207-a1d9-5a0c7da6944e');

INSERT INTO _tracker_seed VALUES ('DataAnnotation', 'https://www.dataannotation.tech/', '', 'Career Website', 'Specialized freelance AI-task platform, not an ordinary employer jobs listing.', 'c53ac293-bc22-42cf-bad7-a4e2cde01b9a');

INSERT INTO _tracker_seed VALUES ('LinkedIn Jobs', 'https://www.linkedin.com/jobs/', '', 'Career Website', 'Third-party job discovery platform.', '5d56a57c-0b2a-4381-aea1-f3a36c436f04');

INSERT INTO _tracker_alias VALUES ('accenture', 'Accenture');

INSERT INTO _tracker_alias VALUES ('accenture plc', 'Accenture');

INSERT INTO _tracker_alias VALUES ('advanced micro devices', 'Advanced Micro Devices (AMD)');

INSERT INTO _tracker_alias VALUES ('advanced micro devices (amd)', 'Advanced Micro Devices (AMD)');

INSERT INTO _tracker_alias VALUES ('algoleap', 'Algoleap Technologies');

INSERT INTO _tracker_alias VALUES ('algoleap technologies', 'Algoleap Technologies');

INSERT INTO _tracker_alias VALUES ('amazon', 'Amazon');

INSERT INTO _tracker_alias VALUES ('amazon jobs', 'Amazon');

INSERT INTO _tracker_alias VALUES ('amazon.com', 'Amazon');

INSERT INTO _tracker_alias VALUES ('amd', 'Advanced Micro Devices (AMD)');

INSERT INTO _tracker_alias VALUES ('anblicks', 'Anblicks');

INSERT INTO _tracker_alias VALUES ('anblicks inc', 'Anblicks');

INSERT INTO _tracker_alias VALUES ('app inventiv', 'Appinventiv');

INSERT INTO _tracker_alias VALUES ('appinventiv', 'Appinventiv');

INSERT INTO _tracker_alias VALUES ('applause', 'Applause');

INSERT INTO _tracker_alias VALUES ('applause app quality', 'Applause');

INSERT INTO _tracker_alias VALUES ('argano', 'Argano');

INSERT INTO _tracker_alias VALUES ('astika', 'Astika Software Limited');

INSERT INTO _tracker_alias VALUES ('astika software', 'Astika Software Limited');

INSERT INTO _tracker_alias VALUES ('astika software limited', 'Astika Software Limited');

INSERT INTO _tracker_alias VALUES ('atlassian', 'Atlassian');

INSERT INTO _tracker_alias VALUES ('atlassian corporation', 'Atlassian');

INSERT INTO _tracker_alias VALUES ('ayr', 'Ayr Energy');

INSERT INTO _tracker_alias VALUES ('ayr energy', 'Ayr Energy');

INSERT INTO _tracker_alias VALUES ('bms', 'Bristol Myers Squibb (BMS)');

INSERT INTO _tracker_alias VALUES ('bondada', 'Bondada Group (Bondada Engineering)');

INSERT INTO _tracker_alias VALUES ('bondada engineering', 'Bondada Group (Bondada Engineering)');

INSERT INTO _tracker_alias VALUES ('bondada group', 'Bondada Group (Bondada Engineering)');

INSERT INTO _tracker_alias VALUES ('bondada group (bondada engineering)', 'Bondada Group (Bondada Engineering)');

INSERT INTO _tracker_alias VALUES ('bristol myers squibb', 'Bristol Myers Squibb (BMS)');

INSERT INTO _tracker_alias VALUES ('bristol myers squibb (bms)', 'Bristol Myers Squibb (BMS)');

INSERT INTO _tracker_alias VALUES ('bristol-myers squibb', 'Bristol Myers Squibb (BMS)');

INSERT INTO _tracker_alias VALUES ('browser stack', 'BrowserStack');

INSERT INTO _tracker_alias VALUES ('browserstack', 'BrowserStack');

INSERT INTO _tracker_alias VALUES ('capgemini', 'Capgemini');

INSERT INTO _tracker_alias VALUES ('capgemini se', 'Capgemini');

INSERT INTO _tracker_alias VALUES ('cimpress', 'Cimpress');

INSERT INTO _tracker_alias VALUES ('cisco', 'Cisco Systems (Cisco)');

INSERT INTO _tracker_alias VALUES ('cisco systems', 'Cisco Systems (Cisco)');

INSERT INTO _tracker_alias VALUES ('cisco systems (cisco)', 'Cisco Systems (Cisco)');

INSERT INTO _tracker_alias VALUES ('cognizant', 'Cognizant');

INSERT INTO _tracker_alias VALUES ('cognizant technology solutions', 'Cognizant');

INSERT INTO _tracker_alias VALUES ('cohere health', 'Cohere Health');

INSERT INTO _tracker_alias VALUES ('coherehealth', 'Cohere Health');

INSERT INTO _tracker_alias VALUES ('corner stone technology services', 'Corner Stone Technology Services (CS TechServ)');

INSERT INTO _tracker_alias VALUES ('corner stone technology services (cs techserv)', 'Corner Stone Technology Services (CS TechServ)');

INSERT INTO _tracker_alias VALUES ('crowe', 'Crowe LLP (Crowe)');

INSERT INTO _tracker_alias VALUES ('crowe llp', 'Crowe LLP (Crowe)');

INSERT INTO _tracker_alias VALUES ('crowe llp (crowe)', 'Crowe LLP (Crowe)');

INSERT INTO _tracker_alias VALUES ('cs techserv', 'Corner Stone Technology Services (CS TechServ)');

INSERT INTO _tracker_alias VALUES ('cts', 'Cognizant');

INSERT INTO _tracker_alias VALUES ('curvion', 'Curvion Blue');

INSERT INTO _tracker_alias VALUES ('curvion blue', 'Curvion Blue');

INSERT INTO _tracker_alias VALUES ('curvionblue', 'Curvion Blue');

INSERT INTO _tracker_alias VALUES ('data annotation', 'DataAnnotation');

INSERT INTO _tracker_alias VALUES ('dataannotation', 'DataAnnotation');

INSERT INTO _tracker_alias VALUES ('dataannotation tech', 'DataAnnotation');

INSERT INTO _tracker_alias VALUES ('databeat', 'Databeat');

INSERT INTO _tracker_alias VALUES ('datadog', 'Datadog');

INSERT INTO _tracker_alias VALUES ('dell', 'Dell Technologies');

INSERT INTO _tracker_alias VALUES ('dell technologies', 'Dell Technologies');

INSERT INTO _tracker_alias VALUES ('deloitte', 'Deloitte');

INSERT INTO _tracker_alias VALUES ('deloitte india', 'Deloitte');

INSERT INTO _tracker_alias VALUES ('deloitte us-india offices', 'Deloitte');

INSERT INTO _tracker_alias VALUES ('deloitte usi', 'Deloitte');

INSERT INTO _tracker_alias VALUES ('equinix', 'Equinix');

INSERT INTO _tracker_alias VALUES ('equinix inc', 'Equinix');

INSERT INTO _tracker_alias VALUES ('f. hoffmann-la roche', 'Roche');

INSERT INTO _tracker_alias VALUES ('franklin templeton', 'Franklin Templeton');

INSERT INTO _tracker_alias VALUES ('franklin templeton investments', 'Franklin Templeton');

INSERT INTO _tracker_alias VALUES ('global data', 'GlobalData Plc (GlobalData)');

INSERT INTO _tracker_alias VALUES ('global logic', 'GlobalLogic');

INSERT INTO _tracker_alias VALUES ('globaldata', 'GlobalData Plc (GlobalData)');

INSERT INTO _tracker_alias VALUES ('globaldata plc (globaldata)', 'GlobalData Plc (GlobalData)');

INSERT INTO _tracker_alias VALUES ('globallogic', 'GlobalLogic');

INSERT INTO _tracker_alias VALUES ('goldman sachs', 'Goldman Sachs (GS)');

INSERT INTO _tracker_alias VALUES ('goldman sachs (gs)', 'Goldman Sachs (GS)');

INSERT INTO _tracker_alias VALUES ('google', 'Google');

INSERT INTO _tracker_alias VALUES ('google careers', 'Google');

INSERT INTO _tracker_alias VALUES ('gs', 'Goldman Sachs (GS)');

INSERT INTO _tracker_alias VALUES ('hcl', 'HCLTech (HCL Technologies)');

INSERT INTO _tracker_alias VALUES ('hcl technologies', 'HCLTech (HCL Technologies)');

INSERT INTO _tracker_alias VALUES ('hcltech', 'HCLTech (HCL Technologies)');

INSERT INTO _tracker_alias VALUES ('hcltech (hcl technologies)', 'HCLTech (HCL Technologies)');

INSERT INTO _tracker_alias VALUES ('ibm', 'International Business Machines (IBM)');

INSERT INTO _tracker_alias VALUES ('intel', 'Intel Corporation');

INSERT INTO _tracker_alias VALUES ('intel corp', 'Intel Corporation');

INSERT INTO _tracker_alias VALUES ('intel corporation', 'Intel Corporation');

INSERT INTO _tracker_alias VALUES ('international business machines', 'International Business Machines (IBM)');

INSERT INTO _tracker_alias VALUES ('international business machines (ibm)', 'International Business Machines (IBM)');

INSERT INTO _tracker_alias VALUES ('intouch cx', 'IntouchCX');

INSERT INTO _tracker_alias VALUES ('intouchcx', 'IntouchCX');

INSERT INTO _tracker_alias VALUES ('j.p. morgan', 'JPMorgan Chase & Co. (JPMC)');

INSERT INTO _tracker_alias VALUES ('jp morgan', 'JPMorgan Chase & Co. (JPMC)');

INSERT INTO _tracker_alias VALUES ('jpmc', 'JPMorgan Chase & Co. (JPMC)');

INSERT INTO _tracker_alias VALUES ('jpmorgan chase', 'JPMorgan Chase & Co. (JPMC)');

INSERT INTO _tracker_alias VALUES ('jpmorgan chase & co. (jpmc)', 'JPMorgan Chase & Co. (JPMC)');

INSERT INTO _tracker_alias VALUES ('linkedin', 'LinkedIn Jobs');

INSERT INTO _tracker_alias VALUES ('linkedin jobs', 'LinkedIn Jobs');

INSERT INTO _tracker_alias VALUES ('lji', 'Loyalty Juggernaut (LJI)');

INSERT INTO _tracker_alias VALUES ('loyalty juggernaut', 'Loyalty Juggernaut (LJI)');

INSERT INTO _tracker_alias VALUES ('loyalty juggernaut (lji)', 'Loyalty Juggernaut (LJI)');

INSERT INTO _tracker_alias VALUES ('lti mindtree', 'LTIMindtree');

INSERT INTO _tracker_alias VALUES ('ltimindtree', 'LTIMindtree');

INSERT INTO _tracker_alias VALUES ('marsh', 'Marsh McLennan (Marsh)');

INSERT INTO _tracker_alias VALUES ('marsh & mclennan', 'Marsh McLennan (Marsh)');

INSERT INTO _tracker_alias VALUES ('marsh mclennan', 'Marsh McLennan (Marsh)');

INSERT INTO _tracker_alias VALUES ('marsh mclennan (marsh)', 'Marsh McLennan (Marsh)');

INSERT INTO _tracker_alias VALUES ('oracle', 'Oracle Corporation');

INSERT INTO _tracker_alias VALUES ('oracle corp', 'Oracle Corporation');

INSERT INTO _tracker_alias VALUES ('oracle corporation', 'Oracle Corporation');

INSERT INTO _tracker_alias VALUES ('pepsi co', 'PepsiCo');

INSERT INTO _tracker_alias VALUES ('pepsico', 'PepsiCo');

INSERT INTO _tracker_alias VALUES ('proto labs', 'Protolabs');

INSERT INTO _tracker_alias VALUES ('protolabs', 'Protolabs');

INSERT INTO _tracker_alias VALUES ('qnity', 'Qnity Electronics (Qnity)');

INSERT INTO _tracker_alias VALUES ('qnity electronics', 'Qnity Electronics (Qnity)');

INSERT INTO _tracker_alias VALUES ('qnity electronics (qnity)', 'Qnity Electronics (Qnity)');

INSERT INTO _tracker_alias VALUES ('qualcomm', 'Qualcomm');

INSERT INTO _tracker_alias VALUES ('qualcomm incorporated', 'Qualcomm');

INSERT INTO _tracker_alias VALUES ('red hat', 'Red Hat');

INSERT INTO _tracker_alias VALUES ('redhat', 'Red Hat');

INSERT INTO _tracker_alias VALUES ('roche', 'Roche');

INSERT INTO _tracker_alias VALUES ('roche pharma', 'Roche');

INSERT INTO _tracker_alias VALUES ('rubixe', 'Rubixe');

INSERT INTO _tracker_alias VALUES ('salesforce', 'Salesforce');

INSERT INTO _tracker_alias VALUES ('salesforce inc', 'Salesforce');

INSERT INTO _tracker_alias VALUES ('sap', 'SAP SE (SAP)');

INSERT INTO _tracker_alias VALUES ('sap se', 'SAP SE (SAP)');

INSERT INTO _tracker_alias VALUES ('sap se (sap)', 'SAP SE (SAP)');

INSERT INTO _tracker_alias VALUES ('service now', 'ServiceNow');

INSERT INTO _tracker_alias VALUES ('servicenow', 'ServiceNow');

INSERT INTO _tracker_alias VALUES ('shine', 'Shine');

INSERT INTO _tracker_alias VALUES ('shine.com', 'Shine');

INSERT INTO _tracker_alias VALUES ('snowflake', 'Snowflake');

INSERT INTO _tracker_alias VALUES ('snowflake inc', 'Snowflake');

INSERT INTO _tracker_alias VALUES ('southwest', 'Southwest Airlines');

INSERT INTO _tracker_alias VALUES ('southwest airlines', 'Southwest Airlines');

INSERT INTO _tracker_alias VALUES ('swa', 'Southwest Airlines');

INSERT INTO _tracker_alias VALUES ('syneos', 'Syneos Health');

INSERT INTO _tracker_alias VALUES ('syneos health', 'Syneos Health');

INSERT INTO _tracker_alias VALUES ('talent 500', 'Talent500');

INSERT INTO _tracker_alias VALUES ('talent500', 'Talent500');

INSERT INTO _tracker_alias VALUES ('tech mahindra', 'Tech Mahindra');

INSERT INTO _tracker_alias VALUES ('techmahindra', 'Tech Mahindra');

INSERT INTO _tracker_alias VALUES ('trc', 'TRC Companies, Inc. (TRC)');

INSERT INTO _tracker_alias VALUES ('trc companies', 'TRC Companies, Inc. (TRC)');

INSERT INTO _tracker_alias VALUES ('trc companies inc', 'TRC Companies, Inc. (TRC)');

INSERT INTO _tracker_alias VALUES ('trc companies, inc. (trc)', 'TRC Companies, Inc. (TRC)');

INSERT INTO _tracker_alias VALUES ('trinet', 'TriNet');

INSERT INTO _tracker_alias VALUES ('trinet group', 'TriNet');

INSERT INTO _tracker_alias VALUES ('ttec', 'TTEC Holdings (TTEC)');

INSERT INTO _tracker_alias VALUES ('ttec holdings', 'TTEC Holdings (TTEC)');

INSERT INTO _tracker_alias VALUES ('ttec holdings (ttec)', 'TTEC Holdings (TTEC)');

INSERT INTO _tracker_alias VALUES ('uhg', 'UnitedHealth Group (UHG)');

INSERT INTO _tracker_alias VALUES ('united health group', 'UnitedHealth Group (UHG)');

INSERT INTO _tracker_alias VALUES ('unitedhealth group', 'UnitedHealth Group (UHG)');

INSERT INTO _tracker_alias VALUES ('unitedhealth group (uhg)', 'UnitedHealth Group (UHG)');

INSERT INTO _tracker_alias VALUES ('wipro', 'Wipro');

INSERT INTO _tracker_alias VALUES ('wipro limited', 'Wipro');

INSERT INTO _tracker_alias VALUES ('workday', 'Workday');

INSERT INTO _tracker_alias VALUES ('workday inc', 'Workday');

INSERT INTO _tracker_alias VALUES ('zoho', 'Zoho Corporation');

INSERT INTO _tracker_alias VALUES ('zoho corporation', 'Zoho Corporation');


UPDATE companies
SET name = (SELECT a.name FROM _tracker_alias a WHERE a.alias = lower(trim(companies.name)) LIMIT 1)
WHERE EXISTS (SELECT 1 FROM _tracker_alias a WHERE a.alias = lower(trim(companies.name)));

-- Retain oldest and most-recent check history: pick existing row with latest check as survivor.
DROP TABLE IF EXISTS _tracker_duplicate_map;
CREATE TABLE _tracker_duplicate_map(id TEXT PRIMARY KEY, keep_id TEXT NOT NULL);
INSERT INTO _tracker_duplicate_map (id, keep_id)
SELECT id,
       FIRST_VALUE(id) OVER (
           PARTITION BY lower(trim(name))
           ORDER BY (last_checked_at IS NULL), last_checked_at DESC, created_at, id
       )
FROM companies;

-- Merge free-text notes from same-name rows before removing duplicates.
UPDATE companies SET notes = COALESCE((
   SELECT group_concat(c2.notes, ' | ') FROM companies c2
   WHERE lower(trim(c2.name)) = lower(trim(companies.name)) AND trim(c2.notes) <> ''
), notes)
WHERE id IN (SELECT keep_id FROM _tracker_duplicate_map);

UPDATE check_log SET company_id = (
  SELECT keep_id FROM _tracker_duplicate_map WHERE id = check_log.company_id
)
WHERE company_id IN (SELECT id FROM _tracker_duplicate_map WHERE id <> keep_id);

DELETE FROM companies WHERE id IN (SELECT id FROM _tracker_duplicate_map WHERE id <> keep_id);

-- For existing matches, repair listing URLs and assign a website type.
UPDATE companies
SET career_url = (SELECT career_url FROM _tracker_seed WHERE name = companies.name),
    site_type = (SELECT site_type FROM _tracker_seed WHERE name = companies.name),
    linkedin_url = CASE WHEN trim(coalesce(companies.linkedin_url,''))='' THEN (SELECT linkedin_url FROM _tracker_seed WHERE name = companies.name) ELSE companies.linkedin_url END,
    notes = CASE
      WHEN trim(coalesce(notes,'')) = '' THEN (SELECT notes FROM _tracker_seed WHERE name = companies.name)
      ELSE notes END
WHERE name IN (SELECT name FROM _tracker_seed);

-- Add only previously unseen companies/job platforms. Existing records are retained.
INSERT INTO companies (id,name,career_url,linkedin_url,site_type,notes,last_checked_at,created_at)
SELECT seed_id, name, career_url, linkedin_url, site_type, notes, NULL,
       strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _tracker_seed s
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE lower(trim(c.name)) = lower(trim(s.name)));

-- Remove known bad navigation URLs from any older unmatched companies.
-- Their company rows are kept for manual review, not deleted.
UPDATE companies SET career_url = ''
WHERE lower(career_url) LIKE '%/applythankyou%'
   OR lower(career_url) LIKE '%/career-thank-you%'
   OR lower(career_url) LIKE '%/thank-you.php%'
   OR lower(career_url) LIKE '%/apply/success%'
   OR lower(career_url) LIKE '%/unavailablecareersection%'
   OR lower(career_url) LIKE '%/maintenance-page.html%'
   OR lower(career_url) LIKE '%/jobtasks/completed/application%'
   OR lower(career_url) LIKE '%/apply/applymanually%'
   OR lower(career_url) LIKE '%/sign_in%'
   OR lower(career_url) LIKE '%/login?%'
   OR lower(career_url) LIKE '%candidateid=%'
   OR lower(career_url) LIKE '%jobapplicationid=%'
   OR lower(career_url) LIKE '%state=%';

-- Final cleanup of temporary import data.
DROP TABLE _tracker_duplicate_map;
DROP TABLE _tracker_alias;
DROP TABLE _tracker_seed;
