-- ============================================================================
-- Migration 066: Real purchaser names from the master spreadsheet
-- ============================================================================
-- Replaces the random/placeholder purchaser names on the developer dashboard
-- with the ACTUAL purchasers from the client's master spreadsheet, for three
-- developments owned by Bridge Property Group:
--   * Longview Park   (e0833063-55ac-4201-a50e-f329c090fbd6)
--   * Rathard Park     (84a559d1-89f1-4eb6-a48b-7ca068bcc164)
--   * Rathard Lawn     (39c49eeb-54a6-4b04-a16a-119012c531cb)
--
-- Social-housing units (already flagged unit_status = 'social_housing') were
-- bought by Clúid Housing Association and are marked as such instead of showing
-- fabricated individual names. This covers the Rathard Lawn units that are
-- "missing" from the spreadsheet because they were sold to Clúid.
--
-- Intentionally NOT touched:
--   * Ardan View              — names are already correct.
--   * 8 Longview Park         — the showhouse, and sam@evolvai.ie's homeowner
--                               test login. Left as-is to preserve that login.
--   * purchaser_email columns — left untouched so all 7 linked homeowner logins
--                               (incl. real owners Binil Jose @64 LP, Umesh Pant
--                               @40 RP) keep working.
--
-- Idempotent / safe to re-run. Apply in the Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- 1) Backup the columns we are about to change (drop+recreate so re-runs are safe)
DROP TABLE IF EXISTS units_purchaser_backup_2026_06_04;
CREATE TABLE units_purchaser_backup_2026_06_04 AS
SELECT id, development_id, unit_number, purchaser_name, purchaser_email, unit_status
FROM units
WHERE development_id IN ('e0833063-55ac-4201-a50e-f329c090fbd6','84a559d1-89f1-4eb6-a48b-7ca068bcc164','39c49eeb-54a6-4b04-a16a-119012c531cb');

DROP TABLE IF EXISTS usp_purchaser_backup_2026_06_04;
CREATE TABLE usp_purchaser_backup_2026_06_04 AS
SELECT usp.unit_id, usp.purchaser_name, usp.sale_type, usp.housing_agency
FROM unit_sales_pipeline usp
JOIN units u ON u.id = usp.unit_id
WHERE u.development_id IN ('e0833063-55ac-4201-a50e-f329c090fbd6','84a559d1-89f1-4eb6-a48b-7ca068bcc164','39c49eeb-54a6-4b04-a16a-119012c531cb');


-- 2) Longview Park: real purchaser names (61 units)
UPDATE units u SET purchaser_name = v.name
FROM (VALUES
  ('1','Mr Herol Dsouza and Ms Janet Miranda'),
  ('2','Mr Dany Jose and Ms Rosemol Joseph'),
  ('3','Ms Ciara Crowley and Mr Shane Cashman'),
  ('4','Mr Mishkath Harees and Ms Raaliya Hussain'),
  ('5','Mr Tadhg Hegarty'),
  ('6','Mr Manivannan Subramanian and Ms Janane Priya Raju'),
  ('7','Ms Orla Brady and Mr David Long'),
  ('9','Delaila Margret Sunil and Sudhin Sunny Varghese'),
  ('10','Sherlin Mery Reji & John Thomas'),
  ('11','Alistair & Yesom Breen'),
  ('12','Ms Jiby Varghese and Jijo Thottiyil Paul'),
  ('13','Peter & Michelle Herlihy'),
  ('14','Tim Mawe & Orlaith O''Suilleabhain'),
  ('15','Ms Emma Barrett'),
  ('16','Ms Triona Cronin and Mr Eoin Cronin'),
  ('17','Ms Kellie Cronin and Mr Cathal Larrigy'),
  ('18','Ms Katie McCarthy and Mr Christopher Hegarty'),
  ('19','Ms Jithara Michael & Godston Plassery'),
  ('20','Dr Hassaan Janjua and Mrs Ayesha Hassaan'),
  ('21','Mr Nikhil John Thekkemuriyil Regi and Ms Anijamariam Varghese'),
  ('22','Mrs Dipali Kadoo and Mr Hyder Ali Sheikh'),
  ('23','Ms Anu Mathew and Mr Joyish Kochadattu Joseph'),
  ('24','Mr Kalvin Ruiz Agustin and Mikella Belresa V. Layug'),
  ('25','Mr Vinod Sebastian and Ms Marysijini Kollamparambill Joseph'),
  ('26','Mr Gopi Kommineni'),
  ('27','Mr Naveen Kumar'),
  ('28','Yan Zhao and Lingli Lu'),
  ('33','Lucy Crowley'),
  ('34','Ms Greeshma Jose and Mr Basil Kooran Varkey'),
  ('35','Ms Emma Lundy and Mr Cillian Williamson'),
  ('36','Mr Suraj Gawade and Ms Aishwarya Hanumant Kodalkar'),
  ('37','Roschelle McSweeney and Cian O''Donovan'),
  ('38','Mr Halimah Baruwa and Ms Sherif Baruwa'),
  ('39','Mr Rima Urboniene and Ms Laurynas Urbonas'),
  ('40','Dr Yineng Wang and Ms Lin Lin'),
  ('41','Ms Akhila Anand and Mr Vishnu Puthenpurackal Sudarsanan'),
  ('42','Mr Mark Dooley and Ms Jodie Forde'),
  ('43','Mr Michael Taylor'),
  ('44','Mr Shanoob Kinaramakkal Moidutty and Ms Amala Job'),
  ('45','Mrs Priya Murugan and Mr Abhilash Surendran Pilla'),
  ('46','Alireza Namadmalan'),
  ('47','Ms Shanza Nazir & MrFahid Idrees'),
  ('48','Brian Goulding & Julie McGinty'),
  ('49','Mr Ullas Suvarna Kumar & Ms Ann Mary Joseph'),
  ('50','Mr Robert Corby & Ms Maeve McDonagh'),
  ('51','Mr Manu Jose & Ms Anumol Joseph'),
  ('52','Mr Yeshwanth Krishnan Jayakumar & Ms Liabhan Collins'),
  ('53','Mr Jaychard Ramos & Ms Sheryl Ramos'),
  ('54','Ms Nithya Maria Bhavan Devasia & Mr Lijo Antony'),
  ('55','Ms Kellie O Mahony & Mr Shane Hourihane'),
  ('56','Ms Alvia Godson Rodrigues & Mr Godson Rodrigues'),
  ('57','Kamlesh A Naykar & Shamika H Mukane'),
  ('58','Ms Josmi George & Mr Shijo Thomas'),
  ('59','Josephine Valin & Abhilash Varghese'),
  ('60','Bessen George & Tiji Thomas'),
  ('61','Rejani Ambujakshy & Shibu Sahadevan'),
  ('62','Muzamil Mohammed Ahmed & Sabreen Ahmed'),
  ('63','Ms Merlin George & Mr Jolly Thomas'),
  ('64','Mr Binil Jose & Ms Febiya Kattukunnel Joy'),
  ('65','Ms Amritha Krishna & Vishnu Sankar'),
  ('66','Ms Denise Luby & Mr Graham Woods')
) AS v(uno, name)
WHERE u.development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6' AND u.unit_number = v.uno;

-- 2) Rathard Park: real purchaser names (40 units)
UPDATE units u SET purchaser_name = v.name
FROM (VALUES
  ('13','Ms Primitha Mohan & Mr Gireesh Nadesan'),
  ('14','Jack Redmond & Megan Gallagher'),
  ('15','Rory O''Connor'),
  ('16','Alison Forde'),
  ('17','Artur Supernak'),
  ('18','Vivek Verma & Maniska Kamal'),
  ('19','Mr Hussain Tariq'),
  ('20','Jayalakshmi Sridharan and Mr Nijin Punnakkan'),
  ('21','Prashant & Shivangi Singh'),
  ('22','Ms Lu Wang'),
  ('23','Rustu & Ozlem Irki'),
  ('24','Sila Gokdeniz Cuze & Ahmet Cuse'),
  ('25','Kayla Smith & Aidan King'),
  ('26','Sarah Clair and Cian O''Rourke'),
  ('27','Mr Andrei Erokhin & Ms Anna Chapurgina'),
  ('28','Mr. Chahin Chahin and Mrs Hazel Kim'),
  ('29','Ms Nicole Obrien & Mr Jordan ahern'),
  ('30','Ms Aimee Purtil'),
  ('31','Ruby Rajan & Renji Arayanparambil Jacob'),
  ('32','Wagas Malik & Neelam Afzal'),
  ('33','Cyriac Stephen'),
  ('34','Mr Bibin Joy & Ms Soniya Johny'),
  ('35','Mark Gleeson and Megan Macmonagle'),
  ('36','Ms Siji Scaria & Mr Senju George'),
  ('37','Billy O''Gorman and Jessica O''Callaghan'),
  ('39','Ms Smruti Amin & Mr Bharat Pareek'),
  ('40','Mr Umesh Chand Pant'),
  ('41','Shane Curtin'),
  ('42','Maheep Bhagwani & Riya Tripathi'),
  ('43','Mr Vikram Sharma & Ms Monika Goswami'),
  ('44','Dean Murray & Danielle Browne'),
  ('45','Nima Sal Sudhan & Samuel Aldana Delgado'),
  ('46','Shauna Ring'),
  ('47','Amy Dolan'),
  ('48','Patrick Puearai & Pamela'),
  ('49','Ms Jaye Sharon Hechanova'),
  ('50','Cait Hooley & Christoper Dilworth'),
  ('51','Mr Bilgihan Celebi'),
  ('52','Amani Younssi'),
  ('53','Kristine J Aguas and Cheerson Aguas')
) AS v(uno, name)
WHERE u.development_id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164' AND u.unit_number = v.uno;

-- 2) Rathard Lawn: real purchaser names (3 units)
UPDATE units u SET purchaser_name = v.name
FROM (VALUES
  ('21','Alexandra Ioana Dogaru & Urko Ullande Reveluata'),
  ('24','Ling Xin Xue & Yanting Wang'),
  ('41','Michael O''Reilly')
) AS v(uno, name)
WHERE u.development_id = '39c49eeb-54a6-4b04-a16a-119012c531cb' AND u.unit_number = v.uno;

-- 3) Clúid social-housing units -> mark as Clúid (these already have
--    unit_status = 'social_housing'; replace fabricated individual names)
UPDATE units
SET purchaser_name = 'Clúid Housing Association'
WHERE development_id IN ('e0833063-55ac-4201-a50e-f329c090fbd6','84a559d1-89f1-4eb6-a48b-7ca068bcc164','39c49eeb-54a6-4b04-a16a-119012c531cb')
  AND unit_status = 'social_housing';

-- 4) Keep the sales pipeline in lockstep with units, and reinforce the
--    social-housing flags so the dashboard's Private/Social split stays correct.
UPDATE unit_sales_pipeline usp
SET purchaser_name = u.purchaser_name,
    sale_type      = CASE WHEN u.unit_status = 'social_housing' THEN 'social' ELSE usp.sale_type END,
    housing_agency = CASE WHEN u.unit_status = 'social_housing' THEN 'Clúid Housing Association' ELSE usp.housing_agency END
FROM units u
WHERE usp.unit_id = u.id
  AND u.development_id IN ('e0833063-55ac-4201-a50e-f329c090fbd6','84a559d1-89f1-4eb6-a48b-7ca068bcc164','39c49eeb-54a6-4b04-a16a-119012c531cb');

COMMIT;

-- ============================================================================
-- Verification (run after COMMIT)
-- ============================================================================
-- Remaining placeholder-style names should be 0 (ignores Ardan View / unit 8):
--   SELECT d.name, u.unit_number, u.purchaser_name
--   FROM units u JOIN developments d ON d.id = u.development_id
--   WHERE u.development_id IN ('e0833063-55ac-4201-a50e-f329c090fbd6','84a559d1-89f1-4eb6-a48b-7ca068bcc164','39c49eeb-54a6-4b04-a16a-119012c531cb')
--     AND u.purchaser_name ~ '@|Demo Purchaser'
--   ORDER BY d.name, u.unit_number;
