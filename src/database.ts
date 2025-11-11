import { Pool, QueryResult } from 'pg'

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
})

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err)
})

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()')
    console.log('✅ PostgreSQL connected successfully:', result.rows[0].now)
    return true
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error)
    return false
  }
}

// Interface for patient submission data
export interface PatientSubmission {
  // Patient Information
  fullName?: string
  email: string
  phone?: string
  dateOfBirth?: string
  
  // Pain Information
  painDuration: string
  painIntensity?: number
  painStart?: string
  
  // Medical History
  additionalHistory?: string
  medications?: string
  mobilityAids?: string
  
  // Goals and Expectations
  timeline?: string
  milestones?: string
  concerns?: string
  
  // Consent
  consent: boolean
  
  // AI Summary
  aiSummary?: string
  
  // Arrays/Objects
  selectedAreas?: string[]
  redFlags?: string[]
  prevOrtho?: string[]
  currentTreatments?: string[]
  dailyImpact?: string[]
  goals?: string[]
  painPoints?: any[]
  
  // Raw form data
  rawFormData?: any
}

// Save patient submission to database
export async function savePatientSubmission(data: PatientSubmission): Promise<number> {
  const query = `
    INSERT INTO patient_submissions (
      full_name, email, phone, date_of_birth,
      pain_duration, pain_intensity, pain_start,
      additional_history, medications, mobility_aids,
      timeline, milestones, concerns,
      consent, ai_summary,
      selected_areas, red_flags, prev_ortho, current_treatments,
      daily_impact, goals, pain_points, raw_form_data
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10,
      $11, $12, $13,
      $14, $15,
      $16, $17, $18, $19,
      $20, $21, $22, $23
    ) RETURNING id
  `
  
  const values = [
    data.fullName || null,
    data.email,
    data.phone || null,
    data.dateOfBirth || null,
    data.painDuration,
    data.painIntensity || null,
    data.painStart || null,
    data.additionalHistory || null,
    data.medications || null,
    data.mobilityAids || null,
    data.timeline || null,
    data.milestones || null,
    data.concerns || null,
    data.consent,
    data.aiSummary || null,
    JSON.stringify(data.selectedAreas || []),
    JSON.stringify(data.redFlags || []),
    JSON.stringify(data.prevOrtho || []),
    JSON.stringify(data.currentTreatments || []),
    JSON.stringify(data.dailyImpact || []),
    JSON.stringify(data.goals || []),
    JSON.stringify(data.painPoints || []),
    JSON.stringify(data.rawFormData || {})
  ]
  
  try {
    const result: QueryResult = await pool.query(query, values)
    return result.rows[0].id
  } catch (error) {
    console.error('Error saving patient submission:', error)
    throw error
  }
}

// Get all submissions (for admin dashboard)
export async function getAllSubmissions(limit = 100, offset = 0): Promise<any[]> {
  const query = `
    SELECT 
      id, full_name, email, phone, pain_duration, pain_intensity,
      selected_areas, submitted_at, ai_summary
    FROM patient_submissions
    ORDER BY submitted_at DESC
    LIMIT $1 OFFSET $2
  `
  
  try {
    const result: QueryResult = await pool.query(query, [limit, offset])
    return result.rows
  } catch (error) {
    console.error('Error fetching submissions:', error)
    throw error
  }
}

// Get submission by ID
export async function getSubmissionById(id: number): Promise<any | null> {
  const query = `
    SELECT * FROM patient_submissions WHERE id = $1
  `
  
  try {
    const result: QueryResult = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching submission:', error)
    throw error
  }
}

// Get submissions by email
export async function getSubmissionsByEmail(email: string): Promise<any[]> {
  const query = `
    SELECT * FROM patient_submissions 
    WHERE email = $1
    ORDER BY submitted_at DESC
  `
  
  try {
    const result: QueryResult = await pool.query(query, [email])
    return result.rows
  } catch (error) {
    console.error('Error fetching submissions by email:', error)
    throw error
  }
}

// Get submission statistics
export async function getSubmissionStats(): Promise<any> {
  const query = `
    SELECT 
      COUNT(*) as total_submissions,
      AVG(pain_intensity) as avg_pain_intensity,
      COUNT(DISTINCT email) as unique_patients,
      MIN(submitted_at) as first_submission,
      MAX(submitted_at) as latest_submission
    FROM patient_submissions
  `
  
  try {
    const result: QueryResult = await pool.query(query)
    return result.rows[0]
  } catch (error) {
    console.error('Error fetching stats:', error)
    throw error
  }
}

// Close pool (for graceful shutdown)
export async function closePool(): Promise<void> {
  await pool.end()
}

export default pool
