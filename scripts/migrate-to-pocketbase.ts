/**
 * Migration Script: Import JSON files to Pocketbase
 * 
 * Run this script with: npx ts-node scripts/migrate-to-pocketbase.ts
 * 
 * Before running:
 * 1. Create collections in Pocketbase Admin UI (use pb_schema.json as reference)
 * 2. Create a course "TESIM" in the courses collection
 * 3. Update ADMIN_EMAIL and ADMIN_PASSWORD below
 */

import PocketBase from 'pocketbase';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PB_URL = 'http://143.47.40.66:9000';
const ADMIN_EMAIL = 'miguelteixeirap@gmail.com';
const ADMIN_PASSWORD = '$cy!4XgDQoDATgu*Hr';

// Course to import to (create this first in Pocketbase)
const COURSE_TITLE = 'TESIM';

interface JsonAnswer {
    text: string;
    value: string;
}

interface JsonQuestion {
    id: number | string;
    text: string;
    answers: JsonAnswer[];
}

interface JsonFile {
    questions: JsonQuestion[];
    exam_info?: { course?: string; date?: string };
    kahoot_info?: { course?: string; theme?: string };
}

const pb = new PocketBase(PB_URL);

async function migrate() {
    console.log('🚀 Starting migration...\n');

    // Login as admin
    try {
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('✅ Logged in as admin\n');
    } catch (error) {
        console.error('❌ Failed to login as admin. Check credentials.');
        process.exit(1);
    }

    // Get or create course
    let course;
    try {
        const courses = await pb.collection('courses').getFullList({
            filter: `title = "${COURSE_TITLE}"`,
        });

        if (courses.length > 0) {
            course = courses[0];
            console.log(`📚 Found existing course: ${course.title} (${course.id})\n`);
        } else {
            course = await pb.collection('courses').create({
                title: COURSE_TITLE,
                description: 'Tecnologias e Sistemas Multimédia',
            });
            console.log(`📚 Created course: ${course.title} (${course.id})\n`);
        }
    } catch (error) {
        console.error('❌ Failed to get/create course:', error);
        process.exit(1);
    }

    // Define source folders and their types
    const sources = [
        { folder: 'previous-exams', source: 'previous', theme: null },
        { folder: 'ai-exams', source: 'ai', theme: null },
        { folder: 'kahoots', source: 'kahoots', theme: null }, // theme will be extracted from file
    ];

    let totalImported = 0;
    let totalSkipped = 0;

    for (const { folder, source } of sources) {
        const folderPath = path.join(__dirname, '..', folder);

        if (!fs.existsSync(folderPath)) {
            console.log(`⚠️  Folder not found: ${folder}, skipping...\n`);
            continue;
        }

        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
        console.log(`📂 Processing ${folder}/ (${files.length} files)...`);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data: JsonFile = JSON.parse(content);

            // Extract theme from kahoot files
            let theme: string | null = null;
            if (source === 'kahoots' && data.kahoot_info?.theme) {
                theme = data.kahoot_info.theme;
            }

            console.log(`  📄 ${file} (${data.questions.length} questions, theme: ${theme || 'none'})`);

            for (const q of data.questions) {
                // Normalize answer values for kahoots
                const answers = q.answers.map(a => ({
                    text: a.text,
                    value: a.value === 'correct' ? '++' : a.value === 'incorrect' ? '--' : a.value,
                }));

                // Check if question already exists (by text, to avoid duplicates)
                try {
                    const existing = await pb.collection('questions').getFirstListItem(
                        `text = "${q.text.replace(/"/g, '\\"')}"`,
                        { requestKey: null }
                    ).catch(() => null);

                    if (existing) {
                        totalSkipped++;
                        continue;
                    }

                    // Create question
                    await pb.collection('questions').create({
                        text: q.text,
                        answers: answers,
                        source: source,
                        theme: theme,
                        course: course.id,
                    });

                    totalImported++;
                } catch (error: any) {
                    console.error(`    ❌ Failed to import question: ${q.text.substring(0, 50)}...`);
                    console.error(`       Error: ${error.message}`);
                }
            }
        }
        console.log('');
    }

    console.log('═══════════════════════════════════════');
    console.log(`✅ Migration complete!`);
    console.log(`   📥 Imported: ${totalImported} questions`);
    console.log(`   ⏭️  Skipped: ${totalSkipped} (already exist)`);
    console.log('═══════════════════════════════════════\n');
}

// Run migration
migrate().catch(console.error);
