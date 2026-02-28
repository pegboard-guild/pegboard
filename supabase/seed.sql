-- Sample zipcode to district mapping (Chicago area examples)
INSERT INTO districts (zipcode, state, district) VALUES
('60601', 'IL', '7'),  -- Chicago Loop
('60602', 'IL', '7'),
('60603', 'IL', '7'),
('60604', 'IL', '7'),
('60605', 'IL', '7'),
('60606', 'IL', '7'),
('60607', 'IL', '7'),
('60608', 'IL', '4'),
('60609', 'IL', '3'),
('60610', 'IL', '5'),
('60611', 'IL', '5'),
('60612', 'IL', '7'),
('60613', 'IL', '5'),
('60614', 'IL', '5'),
('60615', 'IL', '1'),
('60616', 'IL', '3'),
('60617', 'IL', '2'),
('60618', 'IL', '5'),
('60619', 'IL', '1'),
('60620', 'IL', '1'),
('60621', 'IL', '1'),
('60622', 'IL', '5'),
('60623', 'IL', '4'),
('60624', 'IL', '7'),
('60625', 'IL', '9'),
('60626', 'IL', '9'),
('60628', 'IL', '2'),
('60629', 'IL', '3'),
('60630', 'IL', '9'),
('60631', 'IL', '11'),
('60632', 'IL', '4'),
('60634', 'IL', '11'),
('60636', 'IL', '3'),
('60637', 'IL', '1'),
('60638', 'IL', '4'),
('60639', 'IL', '4'),
('60640', 'IL', '9'),
('60641', 'IL', '4'),
('60642', 'IL', '5'),
('60643', 'IL', '2'),
('60644', 'IL', '7'),
('60645', 'IL', '9'),
('60646', 'IL', '9'),
('60647', 'IL', '4'),
('60649', 'IL', '1'),
('60651', 'IL', '4'),
('60652', 'IL', '3'),
('60653', 'IL', '1'),
('60654', 'IL', '5'),
('60655', 'IL', '3'),
('60656', 'IL', '9'),
('60657', 'IL', '5'),
('60659', 'IL', '9'),
('60660', 'IL', '9'),
('60661', 'IL', '5'),
('60707', 'IL', '11'),
('90210', 'CA', '36'),  -- Beverly Hills
('10001', 'NY', '12'),  -- New York
('33101', 'FL', '24'),  -- Miami
('77001', 'TX', '18'),  -- Houston
('98101', 'WA', '7'),   -- Seattle
('30301', 'GA', '5'),   -- Atlanta
('02108', 'MA', '8'),   -- Boston
('85001', 'AZ', '3'),   -- Phoenix
('80202', 'CO', '1'),   -- Denver
('97201', 'OR', '3');   -- Portland

-- Sample Illinois congressional members (current as of 2024)
INSERT INTO members (bioguide_id, name, state, district, party, chamber, website, phone) VALUES
-- Illinois House Representatives
('D000399', 'Danny K. Davis', 'IL', '7', 'D', 'house', 'https://davis.house.gov', '202-225-5006'),
('G000586', 'Jesús "Chuy" García', 'IL', '4', 'D', 'house', 'https://garcia.house.gov', '202-225-8203'),
('K000385', 'Robin L. Kelly', 'IL', '2', 'D', 'house', 'https://robinkelly.house.gov', '202-225-0773'),
('Q000023', 'Mike Quigley', 'IL', '5', 'D', 'house', 'https://quigley.house.gov', '202-225-4061'),
('R000515', 'Bobby L. Rush', 'IL', '1', 'D', 'house', 'https://rush.house.gov', '202-225-4372'),
('S001190', 'Bradley Scott Schneider', 'IL', '10', 'D', 'house', 'https://schneider.house.gov', '202-225-4835'),
('F000454', 'Bill Foster', 'IL', '11', 'D', 'house', 'https://foster.house.gov', '202-225-3515'),
('C001117', 'Sean Casten', 'IL', '6', 'D', 'house', 'https://casten.house.gov', '202-225-4561'),
('N000189', 'Marie Newman', 'IL', '3', 'D', 'house', 'https://newman.house.gov', '202-225-5701'),
('S001208', 'Jan Schakowsky', 'IL', '9', 'D', 'house', 'https://schakowsky.house.gov', '202-225-2111'),
-- Illinois Senators
('D000563', 'Richard J. Durbin', 'IL', NULL, 'D', 'senate', 'https://durbin.senate.gov', '202-224-2152'),
('D000622', 'Tammy Duckworth', 'IL', NULL, 'D', 'senate', 'https://duckworth.senate.gov', '202-224-2854');

-- Sample bills
INSERT INTO bills (bill_id, congress_number, title, summary, status, introduced_date, sponsor_id, last_action, last_action_date) VALUES
('HR-1234', 118, 'Infrastructure Investment Act', 'A bill to provide funding for infrastructure improvements across the United States.', 'In Committee', '2024-01-15', 'D000399', 'Referred to House Transportation Committee', '2024-01-16'),
('HR-2345', 118, 'Healthcare Access Improvement Act', 'A bill to expand healthcare access and reduce costs for American families.', 'Passed House', '2024-02-01', 'Q000023', 'Passed House, sent to Senate', '2024-03-15'),
('S-567', 118, 'Climate Action Now Act', 'A bill to address climate change through renewable energy investments.', 'In Committee', '2024-01-20', 'D000563', 'Referred to Senate Environment Committee', '2024-01-21'),
('HR-3456', 118, 'Education Funding Enhancement Act', 'A bill to increase federal funding for public schools.', 'In Committee', '2024-03-01', 'S001208', 'Referred to House Education Committee', '2024-03-02'),
('S-789', 118, 'Veterans Support Act', 'A bill to improve healthcare and benefits for veterans.', 'Passed Senate', '2024-02-15', 'D000622', 'Passed Senate, sent to House', '2024-04-01');

-- Sample votes
INSERT INTO votes (bill_id, member_id, vote, vote_date) VALUES
-- HR-1234 votes
('HR-1234', 'D000399', 'YES', '2024-03-20'),
('HR-1234', 'G000586', 'YES', '2024-03-20'),
('HR-1234', 'K000385', 'YES', '2024-03-20'),
('HR-1234', 'Q000023', 'YES', '2024-03-20'),
('HR-1234', 'R000515', 'NO', '2024-03-20'),
-- HR-2345 votes
('HR-2345', 'D000399', 'YES', '2024-03-15'),
('HR-2345', 'G000586', 'YES', '2024-03-15'),
('HR-2345', 'K000385', 'YES', '2024-03-15'),
('HR-2345', 'Q000023', 'YES', '2024-03-15'),
('HR-2345', 'S001208', 'YES', '2024-03-15'),
-- S-567 votes
('S-567', 'D000563', 'YES', '2024-04-10'),
('S-567', 'D000622', 'YES', '2024-04-10'),
-- S-789 votes
('S-789', 'D000563', 'YES', '2024-04-01'),
('S-789', 'D000622', 'YES', '2024-04-01');

-- Sample pegs (user opinions)
INSERT INTO pegs (session_id, zipcode, target_type, target_id, sentiment, comment) VALUES
('session-001', '60601', 'bill', 'HR-1234', 'approve', 'We need better infrastructure in Chicago'),
('session-002', '60614', 'bill', 'HR-1234', 'approve', 'Finally addressing our crumbling roads'),
('session-003', '60629', 'bill', 'HR-2345', 'approve', 'Healthcare costs are out of control'),
('session-004', '60601', 'bill', 'HR-2345', 'disapprove', 'This will increase taxes too much'),
('session-005', '60640', 'member', 'S001208', 'approve', 'Great representative for our district'),
('session-006', '60601', 'bill', 'S-567', 'approve', 'Climate action is long overdue'),
('session-007', '60614', 'bill', 'S-789', 'approve', 'Veterans deserve our support');