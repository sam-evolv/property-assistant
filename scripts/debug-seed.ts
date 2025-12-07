import { createClient } from '@supabase/supabase-js';

// 1. SETUP
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_KEY || !SERVICE_KEY.startsWith('ey')) {
  console.error("CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or invalid in Secrets.");
  console.error("It must start with 'ey...'. Please check Replit Secrets.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const PROJECT_ID = '97dc3919-2726-4675-8046-9f79070ec88c';

const csvData = `LV-PARK,1,LV-PARK-001,Mr Herol Dsouza and Ms Janet Miranda,"1 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD01,D,HO,3 Bedroom,3 Bathroom,1396.72
LV-PARK,2,LV-PARK-002,Mr Dany Jose and Ms Rosemol Joseph,2 Longview Park,BD02,D,HO,3 Bedroom,3 Bathroom,1396.72
LV-PARK,3,LV-PARK-003,Ms Ciara Crowley and Mr Shane Cashman,"3 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD01,D,HO,3 Bedroom,3 Bathroom,1396.72
LV-PARK,4,LV-PARK-004,Mr Mishkath Harees and Ms Raaliya Hussain,"4 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD04,D,HO,4 Bedroom,3 Bathroom,1815.76
LV-PARK,5,LV-PARK-005,Mr Tadhg Hegarty,"5 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,6,LV-PARK-006,Mr Manivannan Subramanian and Ms Janane Priya Raju,"6 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,7,LV-PARK-007,Ms Orla Brady and Mr David Long,"7 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,8,LV-PARK-008,Showhouse,"8 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,9,LV-PARK-009,Delaila Margret Sunil and Sudhin Sunny Varghese,"9 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,10,LV-PARK-010,Sherlin Mery Reji & John Thomas,"10 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,11,LV-PARK-011,Alistair & Yesom Breen,"11 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,12,LV-PARK-012,Ms Jiby Varghese and Jijo Thottiyil Paul,"12 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,13,LV-PARK-013,Peter & Michelle Herlihy,"13 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD03,D,HO,4 Bedroom,3 Bathroom,1815.76
LV-PARK,14,LV-PARK-014,Tim Mawe & Orlaith O'Suilleabhain,"14 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD04,D,HO,4 Bedroom,3 Bathroom,1815.76
LV-PARK,15,LV-PARK-015,Ms Emma Barrett,"15 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,16,LV-PARK-016,Ms Triona Cronin and Mr Eoin Cronin,"16 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,17,LV-PARK-017,Ms Kellie Cronin and Mr Cathal Larrigy,"17 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,18,LV-PARK-018,Ms Katie McCarthy and Mr Christopher Hegarty,"18 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,19,LV-PARK-019,Ms Jithara Michael & Godston Plassery,"19 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD03,D,HO,4 Bedroom,3 Bathroom,1815.76
LV-PARK,20,LV-PARK-020,Dr Hassaan Janjua and Mrs Ayesha Hassaan,"20 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,21,LV-PARK-021,Mr Nikhil John Thekkemuriyil Regi and Ms Anijamariam Varghese,"21 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,22,LV-PARK-022,Mrs Dipali Kadoo and Mr Hyder Ali Sheikh,"22 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,23,LV-PARK-023,Ms Anu Mathew and Mr Joyish Kochadattu Joseph,"23 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,24,LV-PARK-024,Mr Kalvin Ruiz Agustin and Mikella Belresa V. Layug,"24 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS02,SD,HO,4 Bedroom,3 Bathroom,1562.92
LV-PARK,25,LV-PARK-025,Mr Vinod Sebastian and Ms Marysijini Kollamparambill Joseph,"25 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS02,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,26,LV-PARK-026,Mr Gopi Kommineni,"26 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,27,LV-PARK-027,Mr Naveen Kumar,"27 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,28,LV-PARK-028,Yan Zhao and Lingli Lu,"28 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD05,D,HO,4 Bedroom,3 Bathroom,1815.76
LV-PARK,29,LV-PARK-029,Cl?id,"29 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BT01,T,HO,3 Bedroom,3 Bathroom,1152.81
LV-PARK,30,LV-PARK-030,Cl?id,"30 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BT01,T,HO,2 Bedroom,2 Bathroom,943.56
LV-PARK,31,LV-PARK-031,Cl?id,"31 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BT01,T,HO,2 Bedroom,2 Bathroom,943.56
LV-PARK,32,LV-PARK-032,Cl?id,"32 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BT01,T,HO,3 Bedroom,3 Bathroom,1152.81
LV-PARK,33,LV-PARK-033,Lucy Crowley,"33 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS03,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,34,LV-PARK-034,Ms Greeshma Jose and Mr Basil Kooran Varkey,"34 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS03,SD,HO,4 Bedroom,3 Bathroom,1562.92
LV-PARK,35,LV-PARK-035,Ms Emma Lundy and Mr Cillian Williamson_x000D_,"35 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD05,D,HO,4 Bedroom,3 Bathroom,1815.76
LV-PARK,36,LV-PARK-036,Mr Suraj Gawade and Ms Aishwarya Hanumant Kodalkar,"36 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,37,LV-PARK-037,Roschelle McSweeney and Cian O'Donovan,"37 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,38,LV-PARK-038,Mr Halimah Baruwa and Ms Sherif Baruwa,"38 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS02,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,39,LV-PARK-039,Mr Rima Urboniene and Ms Laurynas Urbonas,"39 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS02,SD,HO,4 Bedroom,3 Bathroom,1562.92
LV-PARK,40,LV-PARK-040,Dr Yineng Wang and Ms Lin Lin,"40 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS03,SD,HO,4 Bedroom,3 Bathroom,1562.92
LV-PARK,41,LV-PARK-041,Ms Akhila Anand and Mr Vishnu Puthenpurackal Sudarsanan,"41 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS03,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,42,LV-PARK-042,Mr Mark Dooley and Ms Jodie Forde,"42 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,43,LV-PARK-043,Mr Michael Taylor,"43 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,44,LV-PARK-044,Mr Shanoob Kinaramakkal Moidutty and Ms Amala Job,"44 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,45,LV-PARK-045,Mrs Priya Murugan and Mr Abhilash Surendran Pilla,"45 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,46,LV-PARK-046,Alireza Namadmalan,"46 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,47,LV-PARK-047,Ms Shanza Nazir & MrFahid Idrees,"47 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,48,LV-PARK-048,Brian Goulding & Julie McGinty,"48 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD04,D,HO,4 Bedroom,3 Bathroom,1815.76
LV-PARK,49,LV-PARK-049,Mr Ullas Suvarna Kumar & Ms Ann Mary Joseph,"49 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS02,SD,HO,4 Bedroom,3 Bathroom,1562.92
LV-PARK,50,LV-PARK-050,Mr Robert Corby & Ms Maeve McDonagh,"50 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS02,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,51,LV-PARK-051,Mr Manu Jose & Ms Anumol Joseph,"51 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,52,LV-PARK-052,Mr Yeshwanth Krishnan Jayakumar  & Ms Liabhan Collins,"52 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,53,LV-PARK-053,Mr Jaychard Ramos & Ms Sheryl Ramos,"53 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,54,LV-PARK-054,Ms Nithya Maria Bhavan Devasia & Mr Lijo Antony,"54 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,55,LV-PARK-055,Ms Kellie O Mahony & Mr Shane Hourihane,"55 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,56,LV-PARK-056,Ms Alvia Godson Rodrigues & Mr Godson Rodrigues,"56 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,57,LV-PARK-057,Kamlesh A Naykar & Shamika H Mukane,"57 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD17,D,HO,3 Bedroom,3 Bathroom,1396.72
LV-PARK,58,LV-PARK-058,Ms Josmi George & Mr Shijo Thomas,"58 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,59,LV-PARK-059,Josephine Valin & Abhilash Varghese,"59 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,60,LV-PARK-060,Bessen George & Tiji Thomas,"60 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,61,LV-PARK-061,Rejani Ambujakshy & Shibu Sahadevan,"61 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,62,LV-PARK-062,Muzamil Mohammed Ahmed & Sabreen Ahmed,"62 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BD05,D,HO,4 Bedroom,3 Bathroom,1815.76
LV-PARK,63,LV-PARK-063,Ms Merlin George & Mr Jolly Thomas,"63 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,64,LV-PARK-064,Mr Binil Jose & Ms Febiya Kattukunnel Joy,"64 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS01,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,65,LV-PARK-065,Ms Amritha Krishna & Vishnu Sankar,"65 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS04,SD,HO,3 Bedroom,3 Bathroom,1188.33
LV-PARK,66,LV-PARK-066,Ms Denise Luby & Mr Graham Woods,"66 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BS04,SD,HO,4 Bedroom,3 Bathroom,1576.91
LV-PARK,67,LV-PARK-067,Cl?id,"67 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,AP,2 Bedroom,1 Bathroom,822.36
LV-PARK,68,LV-PARK-068,Cl?id,"68 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,AP,2 Bedroom,1 Bathroom,822.36
LV-PARK,69,LV-PARK-069,Cl?id,"69 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,AP,2 Bedroom,1 Bathroom,837.43
LV-PARK,70,LV-PARK-070,Cl?id,"70 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,DP,3 Bedroom,2 Bathroom,1388.54
LV-PARK,71,LV-PARK-071,Cl?id,"71 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,DP,3 Bedroom,2 Bathroom,1388.54
LV-PARK,72,LV-PARK-072,Cl?id,"72 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,DP,3 Bedroom,2 Bathroom,1388.54
LV-PARK,73,LV-PARK-073,Cl?id,"73 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,DP,3 Bedroom,2 Bathroom,1388.54
LV-PARK,74,LV-PARK-074,Cl?id,"74 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,DP,3 Bedroom,2 Bathroom,1388.54
LV-PARK,75,LV-PARK-075,Cl?id,"75 Longview Park, Ballyhooly Road, Ballyvolane, Cork City",BZ01,T,DP,3 Bedroom,2 Bathroom,1517.71`;

const mapDesignation = (code: string) => {
  if (code === 'D') return 'Detached';
  if (code === 'SD') return 'Semi-Detached';
  if (code === 'T') return 'Terrace';
  return code;
};
const mapPropType = (code: string) => {
  if (code === 'HO') return 'House';
  if (code === 'AP') return 'Apartment';
  if (code === 'DP') return 'Duplex';
  return code;
};

async function seed() {
  console.log("Starting Debug Seed...");
  const lines = csvData.split('\n');
  const unitTypesMap = new Map();

  lines.forEach(line => {
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!matches) return;
    const cols = matches.map(m => m.replace(/^"|"$/g, ''));
    const typeCode = cols[5];
    const designation = cols[6];
    const propType = cols[7];
    const beds = cols[8];
    const baths = cols[9];
    const sqft = cols[10];

    if (typeCode && !unitTypesMap.has(typeCode)) {
      unitTypesMap.set(typeCode, {
        name: typeCode,
        floor_plan_pdf_url: 'https://example.com/placeholder.pdf',
        specification_json: {
           designation: mapDesignation(designation),
           property_type: mapPropType(propType),
           bedrooms: beds,
           bathrooms: baths,
           sqft: sqft
        }
      });
    }
  });

  console.log(`Step 1: Found ${unitTypesMap.size} unique house types to process.`);

  for (const [code, typeObj] of unitTypesMap) {
    const { data: existing, error: selectErr } = await supabase.from('unit_types').select('id').eq('name', code).single();

    if (selectErr && selectErr.code !== 'PGRST116') { // PGRST116 = not found
        console.error(`ERROR Fetching Type ${code}:`, selectErr.message);
    }

    if (!existing) {
       const { error: insertErr } = await supabase.from('unit_types').insert({ 
         project_id: PROJECT_ID,
         ...typeObj 
       });
       if (insertErr) {
           console.error(`ERROR Creating House Type ${code}:`, insertErr.message);
       } else {
           console.log(`Created House Type: ${code}`);
       }
    }
  }

  console.log("Step 2: Creating Units...");
  for (const line of lines) {
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!matches) continue;
    const cols = matches.map(m => m.replace(/^"|"$/g, ''));
    const ownerName = cols[3];
    const address = cols[4];
    const typeCode = cols[5];

    // Get Type ID
    const { data: typeData } = await supabase.from('unit_types').select('id').eq('name', typeCode).single();

    if (typeData) {
      const { data: existingUnit } = await supabase.from('units').select('id').eq('address', address).single();

      if (!existingUnit) {
          const { error: insertErr } = await supabase.from('units').insert({
            project_id: PROJECT_ID,
            unit_type_id: typeData.id,
            address: address,
            purchaser_name: ownerName
          });
          if (insertErr) {
              console.error(`ERROR Creating Unit ${address}:`, insertErr.message);
          } else {
              console.log(`Created Unit: ${address}`);
          }
      } else {
        const { error: updateErr } = await supabase.from('units').update({ purchaser_name: ownerName }).eq('id', existingUnit.id);
        if (updateErr) {
             console.error(`ERROR Updating Unit ${address}:`, updateErr.message);
        }
      }
    } else {
        console.error(`Skipping Unit ${address}: House Type ${typeCode} not found in DB.`);
    }
  }
  console.log("Seed Complete!");
}

seed();