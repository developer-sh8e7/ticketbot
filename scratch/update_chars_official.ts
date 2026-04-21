import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CHARACTERS = [
  { name: 'G-TOILET', name_ar: 'G-TOILET', rarity: 'secret', tier: 6, weight: 1, image_url: 'https://i.ibb.co/L1PzDNR/gtoilet.png', description: 'The absolute ruler of the toilet throne.' },
  { name: 'TITAN CAMERAMAN', name_ar: 'TITAN CAMERAMAN', rarity: 'legendary', tier: 5, weight: 3, image_url: 'https://i.ibb.co/L1PzDNR/titancam.png', description: 'The peak of the Alliance power.' },
  { name: 'TITAN TV MAN', name_ar: 'TITAN TV MAN', rarity: 'epic', tier: 4, weight: 6, image_url: 'https://i.ibb.co/L1PzDNR/titantv.png', description: 'Hypnotic dominance.' },
  { name: 'TRALALERO TRALALA', name_ar: 'TRALALERO TRALALA', rarity: 'epic', tier: 4, weight: 6, image_url: 'https://i.ibb.co/L1PzDNR/tralalero.png', description: 'The three-legged legend.' },
  { name: 'BALLERINA CAPPUCCINA', name_ar: 'BALLERINA CAPPUCCINA', rarity: 'rare', tier: 3, weight: 12, image_url: 'https://i.ibb.co/L1PzDNR/ballerina.png', description: 'Graceful caffeine.' },
  { name: 'BOMBARDINO CROCODILO', name_ar: 'BOMBARDINO CROCODILO', rarity: 'rare', tier: 3, weight: 12, image_url: 'https://i.ibb.co/L1PzDNR/bombardino.png', description: 'Aerial predator.' },
  { name: 'SIGMA SIGMA', name_ar: 'SIGMA SIGMA', rarity: 'uncommon', tier: 2, weight: 20, image_url: 'https://i.ibb.co/L1PzDNR/sigma.png', description: 'Pure confidence.' },
  { name: 'BYE BYE MEWING', name_ar: 'BYE BYE MEWING', rarity: 'common', tier: 1, weight: 40, image_url: 'https://i.ibb.co/L1PzDNR/mewing.png', description: 'Silence is power.' }
];

async function update() {
  console.log("Updating Brainrot Characters (Final Pass)...");
  // Clear old
  await supabase.from('brainrot_characters').delete().neq('name', '___NON_EXISTENT___');
  // Insert new
  const { error } = await supabase.from('brainrot_characters').insert(CHARACTERS);
  if (error) console.error(error);
  else console.log("Database updated successfully.");
}

update();
