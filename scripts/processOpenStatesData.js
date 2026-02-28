#!/usr/bin/env node

// Script to process OpenStates bulk data and create JSON files for the app
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Path to the cloned OpenStates people repository
const PEOPLE_DATA_PATH = '/Users/officeimac/pegboard/data/openstates/people/data';
const OUTPUT_PATH = '/Users/officeimac/pegboard/data/processed';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_PATH)) {
  fs.mkdirSync(OUTPUT_PATH, { recursive: true });
}

// State code mapping
const STATE_CODES = {
  'al': 'Alabama', 'ak': 'Alaska', 'az': 'Arizona', 'ar': 'Arkansas',
  'ca': 'California', 'co': 'Colorado', 'ct': 'Connecticut', 'de': 'Delaware',
  'fl': 'Florida', 'ga': 'Georgia', 'hi': 'Hawaii', 'id': 'Idaho',
  'il': 'Illinois', 'in': 'Indiana', 'ia': 'Iowa', 'ks': 'Kansas',
  'ky': 'Kentucky', 'la': 'Louisiana', 'me': 'Maine', 'md': 'Maryland',
  'ma': 'Massachusetts', 'mi': 'Michigan', 'mn': 'Minnesota', 'ms': 'Mississippi',
  'mo': 'Missouri', 'mt': 'Montana', 'ne': 'Nebraska', 'nv': 'Nevada',
  'nh': 'New Hampshire', 'nj': 'New Jersey', 'nm': 'New Mexico', 'ny': 'New York',
  'nc': 'North Carolina', 'nd': 'North Dakota', 'oh': 'Ohio', 'ok': 'Oklahoma',
  'or': 'Oregon', 'pa': 'Pennsylvania', 'ri': 'Rhode Island', 'sc': 'South Carolina',
  'sd': 'South Dakota', 'tn': 'Tennessee', 'tx': 'Texas', 'ut': 'Utah',
  'vt': 'Vermont', 'va': 'Virginia', 'wa': 'Washington', 'wv': 'West Virginia',
  'wi': 'Wisconsin', 'wy': 'Wyoming', 'dc': 'District of Columbia'
};

function processState(stateCode) {
  const statePath = path.join(PEOPLE_DATA_PATH, stateCode);
  const legislaturePath = path.join(statePath, 'legislature');
  
  if (!fs.existsSync(legislaturePath)) {
    console.log(`No legislature data for ${stateCode}`);
    return null;
  }

  const legislators = [];
  const files = fs.readdirSync(legislaturePath);
  
  files.forEach(file => {
    if (file.endsWith('.yml')) {
      try {
        const filePath = path.join(legislaturePath, file);
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const data = yaml.load(fileContents);
        
        if (data && data.name) {
          // Extract current role
          const currentRole = data.roles && data.roles.length > 0 
            ? data.roles[data.roles.length - 1] 
            : null;
          
          legislators.push({
            id: data.id,
            name: data.name,
            given_name: data.given_name,
            family_name: data.family_name,
            party: data.party ? data.party[0] : null,
            email: data.email,
            image: data.image,
            current_role: currentRole ? {
              title: currentRole.type,
              chamber: currentRole.type === 'upper' ? 'senate' : 'house',
              district: currentRole.district,
              jurisdiction: currentRole.jurisdiction,
              start_date: currentRole.start_date,
              end_date: currentRole.end_date
            } : null,
            contact_details: data.contact_details || [],
            links: data.links || [],
            sources: data.sources || []
          });
        }
      } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
      }
    }
  });
  
  return {
    state: stateCode,
    state_name: STATE_CODES[stateCode],
    legislators: legislators,
    count: legislators.length,
    last_updated: new Date().toISOString()
  };
}

function processAllStates() {
  console.log('Processing OpenStates bulk data...');
  const allData = {};
  const summary = {
    total_legislators: 0,
    states_processed: 0,
    states_with_data: [],
    processing_date: new Date().toISOString()
  };

  // Check if people data exists
  if (!fs.existsSync(PEOPLE_DATA_PATH)) {
    console.error(`Data path not found: ${PEOPLE_DATA_PATH}`);
    console.error('Please ensure OpenStates people repository is cloned to /Users/officeimac/pegboard/data/openstates/');
    return;
  }

  const states = fs.readdirSync(PEOPLE_DATA_PATH);
  
  states.forEach(stateCode => {
    if (STATE_CODES[stateCode]) {
      console.log(`Processing ${stateCode}...`);
      const stateData = processState(stateCode);
      
      if (stateData && stateData.legislators.length > 0) {
        allData[stateCode] = stateData;
        summary.total_legislators += stateData.legislators.length;
        summary.states_with_data.push(stateCode);
        
        // Save individual state file
        const stateFile = path.join(OUTPUT_PATH, `${stateCode}-legislators.json`);
        fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2));
      }
      
      summary.states_processed++;
    }
  });
  
  // Save combined data
  const allDataFile = path.join(OUTPUT_PATH, 'all-legislators.json');
  fs.writeFileSync(allDataFile, JSON.stringify(allData, null, 2));
  
  // Save summary
  const summaryFile = path.join(OUTPUT_PATH, 'processing-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log('\n=== Processing Complete ===' );
  console.log(`States processed: ${summary.states_processed}`);
  console.log(`States with data: ${summary.states_with_data.length}`);
  console.log(`Total legislators: ${summary.total_legislators}`);
  console.log(`\nOutput saved to: ${OUTPUT_PATH}`);
}

// Run the processor
processAllStates();