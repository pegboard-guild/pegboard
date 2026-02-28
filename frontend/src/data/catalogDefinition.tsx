import React from 'react';
import {
  FileText, Users, Building2, Gavel, DollarSign, ScrollText,
  Map, School, Droplet, Bus, Calendar, Vote, BookOpen,
  Briefcase, Scale, AlertCircle, Globe, Home, Building,
  Flag, Award, PieChart, FileCheck, Megaphone, Shield,
  Activity, Archive, Clock, TrendingUp
} from 'lucide-react';

export interface CatalogHole {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  route_key: string;
  source: string;
  description?: string;
  currentPhase?: string;
  icon: () => React.ReactNode;
  peggable: boolean;
  dataAvailable: boolean;
  dataService?: string; // Which service can fetch this data
  apiEndpoint?: string; // Specific endpoint if known
}

// Based on our objective_canvas_catalog.yaml and available services
export const getCatalogDefinition = (): CatalogHole[] => [
  // ============ FEDERAL LEVEL ============

  // Federal - Congress Metadata
  {
    id: 'federal.congress_metadata.sessions_calendar',
    category: 'federal',
    subcategory: 'congress_metadata',
    name: 'Congressional Sessions',
    route_key: 'congress.gov:sessions',
    source: 'congress.gov',
    description: 'Congressional calendar and session schedules',
    icon: () => <Calendar size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },
  {
    id: 'federal.congress_metadata.chamber_rules',
    category: 'federal',
    subcategory: 'congress_metadata',
    name: 'Chamber Rules',
    route_key: 'congress.gov:chamber-rules',
    source: 'congress.gov',
    description: 'House and Senate procedural rules',
    icon: () => <BookOpen size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Federal - Members
  {
    id: 'federal.members.roster_current',
    category: 'federal',
    subcategory: 'members',
    name: 'Current Members',
    route_key: 'congress.gov:members',
    source: 'congress.gov',
    description: 'All current members of Congress',
    icon: () => <Users size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI',
    apiEndpoint: '/members'
  },
  {
    id: 'federal.members.member_profile',
    category: 'federal',
    subcategory: 'members',
    name: 'Member Profiles',
    route_key: 'congress.gov:member-profile',
    source: 'congress.gov',
    description: 'Detailed profiles of representatives',
    icon: () => <Users size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'representativeService'
  },
  {
    id: 'federal.members.financial_disclosures',
    category: 'federal',
    subcategory: 'members',
    name: 'Financial Disclosures',
    route_key: 'clerk:financial-disclosures',
    source: 'clerk_ethics',
    description: 'Member financial disclosure reports',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.members.stock_trades',
    category: 'federal',
    subcategory: 'members',
    name: 'Stock Trades',
    route_key: 'clerk:stock-trades',
    source: 'clerk_ethics',
    description: 'Congressional stock trading activity',
    icon: () => <TrendingUp size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.members.committee_membership',
    category: 'federal',
    subcategory: 'members',
    name: 'Committee Memberships',
    route_key: 'congress.gov:committee-members',
    source: 'congress.gov',
    description: 'Committee assignments and roles',
    icon: () => <Building2 size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },
  {
    id: 'federal.members.member_votes',
    category: 'federal',
    subcategory: 'members',
    name: 'Member Vote Records',
    route_key: 'congress.gov:member-votes',
    source: 'congress.gov',
    description: 'How each member voted on bills',
    icon: () => <Vote size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },

  // Federal - Legislation
  {
    id: 'federal.legislation.bill_status',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Bill Status Tracking',
    route_key: 'congress.gov:bill-status',
    source: 'congress.gov',
    description: 'Track any federal bill through its lifecycle',
    icon: () => <FileText size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI',
    apiEndpoint: '/bills'
  },
  {
    id: 'federal.legislation.bill_text',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Bill Text & Versions',
    route_key: 'govinfo:bill-text-version',
    source: 'govinfo',
    description: 'Full text of bills at each stage',
    icon: () => <FileText size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'govinfoService'
  },
  {
    id: 'federal.legislation.public_laws',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Public Laws',
    route_key: 'govinfo:public-law-pdf',
    source: 'govinfo',
    description: 'Enacted laws in final form',
    icon: () => <Scale size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'govinfoService'
  },
  {
    id: 'federal.legislation.sponsors',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Sponsors & Cosponsors',
    route_key: 'congress.gov:sponsors-cosponsors',
    source: 'congress.gov',
    description: 'Bill sponsorship information',
    icon: () => <Users size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },
  {
    id: 'federal.legislation.amendments',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Amendments',
    route_key: 'congress.gov:amendments',
    source: 'congress.gov',
    description: 'Proposed changes to bills',
    icon: () => <FileText size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },
  {
    id: 'federal.legislation.committee_reports',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Committee Reports',
    route_key: 'govinfo:committee-report',
    source: 'govinfo',
    description: 'Committee analysis and recommendations',
    icon: () => <Briefcase size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'govinfoService'
  },
  {
    id: 'federal.legislation.cbo_scores',
    category: 'federal',
    subcategory: 'legislation',
    name: 'CBO Cost Estimates',
    route_key: 'cbo:cost-estimate',
    source: 'cbo',
    description: 'Budget impact analysis',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.legislation.floor_schedule',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Floor Schedule',
    route_key: 'congress.gov:floor-schedule',
    source: 'congress.gov',
    description: 'Upcoming votes and debates',
    icon: () => <Calendar size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },
  {
    id: 'federal.legislation.roll_call_votes',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Roll Call Votes',
    route_key: 'congress.gov:roll-call-vote-final',
    source: 'congress.gov',
    description: 'Official vote records',
    icon: () => <Vote size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },
  {
    id: 'federal.legislation.congressional_record',
    category: 'federal',
    subcategory: 'legislation',
    name: 'Congressional Record',
    route_key: 'govinfo:congressional-record-daily',
    source: 'govinfo',
    description: 'Official proceedings and debates',
    icon: () => <Archive size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'govinfoService'
  },

  // Federal - Executive
  {
    id: 'federal.executive.orders',
    category: 'federal',
    subcategory: 'executive',
    name: 'Executive Orders',
    route_key: 'whitehouse.gov:executive-order-document',
    source: 'whitehouse.gov',
    description: 'Presidential executive orders',
    icon: () => <ScrollText size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.executive.nominations',
    category: 'federal',
    subcategory: 'executive',
    name: 'Presidential Nominations',
    route_key: 'congress.gov:nominations',
    source: 'congress.gov',
    description: 'Presidential appointments requiring confirmation',
    icon: () => <Award size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },
  {
    id: 'federal.executive.veto_messages',
    category: 'federal',
    subcategory: 'executive',
    name: 'Veto Messages',
    route_key: 'whitehouse.gov:veto-message',
    source: 'whitehouse.gov',
    description: 'Presidential veto explanations',
    icon: () => <AlertCircle size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Federal - Regulations
  {
    id: 'federal.regulations.proposed_rules',
    category: 'federal',
    subcategory: 'regulations',
    name: 'Proposed Rules (NPRM)',
    route_key: 'federalregister:nprm',
    source: 'federalregister',
    description: 'Rules open for public comment',
    icon: () => <ScrollText size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'federalRegister'
  },
  {
    id: 'federal.regulations.final_rules',
    category: 'federal',
    subcategory: 'regulations',
    name: 'Final Rules',
    route_key: 'federalregister:final-rule',
    source: 'federalregister',
    description: 'Finalized federal regulations',
    icon: () => <FileCheck size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'federalRegister'
  },
  {
    id: 'federal.regulations.cfr_updates',
    category: 'federal',
    subcategory: 'regulations',
    name: 'Code of Federal Regulations',
    route_key: 'ecfr:part',
    source: 'ecfr',
    description: 'Current federal regulations by topic',
    icon: () => <BookOpen size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Federal - Judiciary
  {
    id: 'federal.judiciary.scotus_opinions',
    category: 'federal',
    subcategory: 'judiciary',
    name: 'Supreme Court Opinions',
    route_key: 'court:opinion-slip',
    source: 'scotus',
    description: 'Supreme Court decisions',
    icon: () => <Gavel size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.judiciary.oral_arguments',
    category: 'federal',
    subcategory: 'judiciary',
    name: 'Oral Arguments',
    route_key: 'court:oral-argument',
    source: 'scotus',
    description: 'Supreme Court argument transcripts',
    icon: () => <Megaphone size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Federal - Finance & Spending
  {
    id: 'federal.spending.contracts',
    category: 'federal',
    subcategory: 'spending',
    name: 'Government Contracts',
    route_key: 'usaspending:award',
    source: 'usaspending',
    description: 'Federal contract awards',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'usaSpending'
  },
  {
    id: 'federal.spending.grants',
    category: 'federal',
    subcategory: 'spending',
    name: 'Federal Grants',
    route_key: 'usaspending:subaward',
    source: 'usaspending',
    description: 'Federal grant distributions',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'usaSpending'
  },
  {
    id: 'federal.spending.budget',
    category: 'federal',
    subcategory: 'spending',
    name: "President's Budget",
    route_key: 'omb:presidents-budget',
    source: 'omb',
    description: 'Annual budget proposals',
    icon: () => <PieChart size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.spending.appropriations',
    category: 'federal',
    subcategory: 'spending',
    name: 'Appropriations Status',
    route_key: 'congress.gov:appropriations-status',
    source: 'congress.gov',
    description: 'Federal budget appropriations',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'congressAPI'
  },

  // Federal - Oversight & Ethics
  {
    id: 'federal.oversight.gao_reports',
    category: 'federal',
    subcategory: 'oversight',
    name: 'GAO Reports',
    route_key: 'gao:reports',
    source: 'gao',
    description: 'Government accountability investigations',
    icon: () => <Shield size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.oversight.ig_reports',
    category: 'federal',
    subcategory: 'oversight',
    name: 'Inspector General Reports',
    route_key: 'oig:reports',
    source: 'inspectors_general',
    description: 'Agency oversight reports',
    icon: () => <Shield size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Federal - Elections & Campaigns
  {
    id: 'federal.elections.results',
    category: 'federal',
    subcategory: 'elections',
    name: 'Election Results',
    route_key: 'elections:results',
    source: 'state_fed_elections',
    description: 'Federal election outcomes',
    icon: () => <Vote size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.elections.fec_filings',
    category: 'federal',
    subcategory: 'elections',
    name: 'Campaign Finance',
    route_key: 'fec:committee-filings',
    source: 'fec',
    description: 'Campaign contribution reports',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'federal.elections.lobbying',
    category: 'federal',
    subcategory: 'elections',
    name: 'Lobbying Disclosures',
    route_key: 'lda:quarterly-filings',
    source: 'lda',
    description: 'Registered lobbyist activity',
    icon: () => <Briefcase size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // ============ STATE LEVEL ============

  // State - Legislation
  {
    id: 'state.legislation.bills',
    category: 'state',
    subcategory: 'legislation',
    name: 'State Bills',
    route_key: 'openstates:bill-status',
    source: 'openstates',
    description: 'State legislative proposals',
    icon: () => <FileText size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'openstates'
  },
  {
    id: 'state.legislation.bill_text',
    category: 'state',
    subcategory: 'legislation',
    name: 'State Bill Text',
    route_key: 'state_register:bill-text-version',
    source: 'state_register',
    description: 'Full text of state bills',
    icon: () => <FileText size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'state.legislation.votes',
    category: 'state',
    subcategory: 'legislation',
    name: 'State Vote Records',
    route_key: 'openstates:vote-event',
    source: 'openstates',
    description: 'State legislative votes',
    icon: () => <Vote size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'openstates'
  },
  {
    id: 'state.legislation.committees',
    category: 'state',
    subcategory: 'legislation',
    name: 'State Committees',
    route_key: 'openstates:committee-members',
    source: 'openstates',
    description: 'State legislative committees',
    icon: () => <Building2 size={20} />,
    peggable: true,
    dataAvailable: true,
    dataService: 'openstates'
  },
  {
    id: 'state.legislation.hearings',
    category: 'state',
    subcategory: 'legislation',
    name: 'Committee Hearings',
    route_key: 'state_leg:hearings',
    source: 'state_leg_portal',
    description: 'State committee hearings',
    icon: () => <Calendar size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // State - Executive & Regulatory
  {
    id: 'state.executive.governor_orders',
    category: 'state',
    subcategory: 'executive',
    name: 'Governor Executive Orders',
    route_key: 'state_exec:orders',
    source: 'state_exec_portal',
    description: 'Gubernatorial executive actions',
    icon: () => <ScrollText size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'state.regulatory.proposed_rules',
    category: 'state',
    subcategory: 'regulatory',
    name: 'State Proposed Rules',
    route_key: 'state_register:nprm',
    source: 'state_register',
    description: 'State regulations open for comment',
    icon: () => <ScrollText size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'state.regulatory.ag_opinions',
    category: 'state',
    subcategory: 'regulatory',
    name: 'Attorney General Opinions',
    route_key: 'state_ag:opinions',
    source: 'state_ag',
    description: 'State legal interpretations',
    icon: () => <Scale size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // State - Spending & Procurement
  {
    id: 'state.spending.payments',
    category: 'state',
    subcategory: 'spending',
    name: 'State Vendor Payments',
    route_key: 'state_open_data:payments',
    source: 'state_open_data',
    description: 'State spending on vendors',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'state.spending.contracts',
    category: 'state',
    subcategory: 'spending',
    name: 'State Contracts',
    route_key: 'state_procurement:awards',
    source: 'state_procurement',
    description: 'State contract awards',
    icon: () => <Briefcase size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // State - Elections & Ethics
  {
    id: 'state.elections.results',
    category: 'state',
    subcategory: 'elections',
    name: 'State Election Results',
    route_key: 'state_elections:results',
    source: 'state_elections',
    description: 'State and local election outcomes',
    icon: () => <Vote size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'state.elections.campaign_finance',
    category: 'state',
    subcategory: 'elections',
    name: 'State Campaign Finance',
    route_key: 'state_cf:filings',
    source: 'state_cf_portal',
    description: 'State campaign contributions',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'state.elections.lobbying',
    category: 'state',
    subcategory: 'elections',
    name: 'State Lobbying Reports',
    route_key: 'state_lobby:reports',
    source: 'state_lobby',
    description: 'State lobbyist activity',
    icon: () => <Briefcase size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // ============ LOCAL LEVEL ============

  // Local - Council/Commission
  {
    id: 'local.council.roster',
    category: 'local',
    subcategory: 'council',
    name: 'City Council Members',
    route_key: 'local:roster',
    source: 'local_portal',
    description: 'Your local elected officials',
    icon: () => <Users size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.council.legislation',
    category: 'local',
    subcategory: 'council',
    name: 'City Ordinances',
    route_key: 'local:legislation',
    source: 'local_portal',
    description: 'Local laws and resolutions',
    icon: () => <FileText size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.council.meetings',
    category: 'local',
    subcategory: 'council',
    name: 'Council Meeting Agendas',
    route_key: 'local:agenda',
    source: 'local_portal',
    description: 'Upcoming meeting topics',
    icon: () => <Calendar size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.council.minutes',
    category: 'local',
    subcategory: 'council',
    name: 'Meeting Minutes',
    route_key: 'local:minutes-votes',
    source: 'local_portal',
    description: 'Records of council decisions',
    icon: () => <Archive size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Local - Planning & Permitting
  {
    id: 'local.planning.zoning',
    category: 'local',
    subcategory: 'planning',
    name: 'Zoning Cases',
    route_key: 'local:planning-zoning-cases',
    source: 'city_planning',
    description: 'Zoning changes and variances',
    icon: () => <Map size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.planning.permits',
    category: 'local',
    subcategory: 'planning',
    name: 'Building Permits',
    route_key: 'local:building-permits',
    source: 'city_permits',
    description: 'Construction and development permits',
    icon: () => <Building size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.planning.incentives',
    category: 'local',
    subcategory: 'planning',
    name: 'Development Incentives',
    route_key: 'local:incentives',
    source: 'economic_development',
    description: 'Tax breaks and development deals',
    icon: () => <TrendingUp size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Local - Finance & Procurement
  {
    id: 'local.procurement.payments',
    category: 'local',
    subcategory: 'procurement',
    name: 'City Vendor Payments',
    route_key: 'local:payments',
    source: 'city_open_data',
    description: 'City spending on vendors',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.procurement.contracts',
    category: 'local',
    subcategory: 'procurement',
    name: 'City Contracts',
    route_key: 'local:contract-awards',
    source: 'city_procurement',
    description: 'Municipal contract awards',
    icon: () => <Briefcase size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.procurement.rfps',
    category: 'local',
    subcategory: 'procurement',
    name: 'Open Solicitations',
    route_key: 'local:procurement-solicitations',
    source: 'city_procurement',
    description: 'RFPs and bidding opportunities',
    icon: () => <FileText size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Local - Public Safety & Justice
  {
    id: 'local.safety.police_policies',
    category: 'local',
    subcategory: 'safety',
    name: 'Police Policies',
    route_key: 'local:police-policies',
    source: 'police_portal',
    description: 'Law enforcement procedures',
    icon: () => <Shield size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.safety.crime_stats',
    category: 'local',
    subcategory: 'safety',
    name: 'Crime Statistics',
    route_key: 'local:police-stats',
    source: 'city_open_data',
    description: 'Local crime data and trends',
    icon: () => <Activity size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'local.safety.court_dockets',
    category: 'local',
    subcategory: 'safety',
    name: 'Municipal Court Dockets',
    route_key: 'local:court-dockets',
    source: 'local_courts',
    description: 'Local court schedules',
    icon: () => <Gavel size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // ============ HYPERLOCAL LEVEL ============

  // Hyperlocal - School Board
  {
    id: 'hyperlocal.school.roster',
    category: 'hyperlocal',
    subcategory: 'school',
    name: 'School Board Members',
    route_key: 'school:roster',
    source: 'district_portal',
    description: 'Your elected school board',
    icon: () => <Users size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'hyperlocal.school.budget',
    category: 'hyperlocal',
    subcategory: 'school',
    name: 'School District Budget',
    route_key: 'school:budget',
    source: 'district_portal',
    description: 'School spending and allocations',
    icon: () => <DollarSign size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'hyperlocal.school.meetings',
    category: 'hyperlocal',
    subcategory: 'school',
    name: 'School Board Meetings',
    route_key: 'school:meetings',
    source: 'district_portal',
    description: 'Board meeting agendas and minutes',
    icon: () => <Calendar size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'hyperlocal.school.policies',
    category: 'hyperlocal',
    subcategory: 'school',
    name: 'District Policies',
    route_key: 'school:policies',
    source: 'district_portal',
    description: 'School district rules and procedures',
    icon: () => <BookOpen size={20} />,
    peggable: true,
    dataAvailable: false
  },

  // Hyperlocal - Special Districts
  {
    id: 'hyperlocal.special.water',
    category: 'hyperlocal',
    subcategory: 'special',
    name: 'Water District',
    route_key: 'water:rates-quality',
    source: 'water_district',
    description: 'Water rates and quality reports',
    icon: () => <Droplet size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'hyperlocal.special.transit',
    category: 'hyperlocal',
    subcategory: 'special',
    name: 'Transit Authority',
    route_key: 'transit:projects',
    source: 'transit_authority',
    description: 'Public transit projects and budgets',
    icon: () => <Bus size={20} />,
    peggable: true,
    dataAvailable: false
  },
  {
    id: 'hyperlocal.special.hospital',
    category: 'hyperlocal',
    subcategory: 'special',
    name: 'Hospital District',
    route_key: 'hospital:board-meetings',
    source: 'hospital_district',
    description: 'Public hospital governance',
    icon: () => <Activity size={20} />,
    peggable: true,
    dataAvailable: false
  }
];

export const catalogDefinition = getCatalogDefinition();

// Helper function to get catalog items by category
export const getCatalogByCategory = (category: string): CatalogHole[] => {
  return catalogDefinition.filter(hole => hole.category === category);
};

// Helper function to get catalog items by subcategory
export const getCatalogBySubcategory = (category: string, subcategory: string): CatalogHole[] => {
  return catalogDefinition.filter(hole =>
    hole.category === category && hole.subcategory === subcategory
  );
};

// Helper function to get available data sources
export const getAvailableDataSources = (): CatalogHole[] => {
  return catalogDefinition.filter(hole => hole.dataAvailable === true);
};

// Get subcategory metadata
export const subcategoryMetadata: { [key: string]: { label: string; description: string } } = {
  // Federal
  'congress_metadata': { label: 'Congressional Operations', description: 'How Congress functions' },
  'members': { label: 'Members of Congress', description: 'Representatives and their activities' },
  'legislation': { label: 'Legislative Process', description: 'Bills, votes, and lawmaking' },
  'executive': { label: 'Executive Branch', description: 'Presidential actions and appointments' },
  'regulations': { label: 'Federal Regulations', description: 'Agency rules and regulations' },
  'judiciary': { label: 'Federal Courts', description: 'Court decisions and proceedings' },
  'spending': { label: 'Federal Spending', description: 'Budget and contracts' },
  'oversight': { label: 'Oversight & Ethics', description: 'Government accountability' },
  'elections': { label: 'Elections & Campaigns', description: 'Electoral and campaign finance' },

  // State
  'regulatory': { label: 'State Regulations', description: 'State agency rules' },

  // Local
  'council': { label: 'City Council', description: 'Local legislative body' },
  'planning': { label: 'Planning & Development', description: 'Zoning and permits' },
  'procurement': { label: 'City Contracts', description: 'Municipal spending' },
  'safety': { label: 'Public Safety', description: 'Police and courts' },

  // Hyperlocal
  'school': { label: 'School Board', description: 'Education governance' },
  'special': { label: 'Special Districts', description: 'Utility and service districts' }
};


