import { query } from '../db.js';
import ragService from './ragService.js';
import medbotService from './medbotService.js';
import dotenv from 'dotenv';

dotenv.config();

class MedicineService {
  constructor() {
    this.similarityThreshold = 0.6; // Lower threshold for medicine search
    this.maxResults = 20;
    this.embeddingDimension = 4096; // Dimension for cniongolo/biomistral model
    console.log('✅ Medicine Service initialized');
  }

  /**
   * Search medicines using hybrid approach: RAG + Fuzzy text search
   * @param {string} searchQuery - Natural language search query
   * @param {number} limit - Maximum number of results
   * @returns {Promise<array>} - Array of medicine results with similarity scores
   */
  async searchMedicines(searchQuery, limit = null) {
    try {
      console.log(`\n🔍 Medicine Search Query: "${searchQuery}"`);
      
      if (!searchQuery || searchQuery.trim().length === 0) {
        throw new Error('Search query is required');
      }

      const resultLimit = limit || this.maxResults;
      
      // If query is short (likely a medicine name), also do fuzzy text search
      const isShortQuery = searchQuery.trim().split(/\s+/).length <= 3;
      
      if (isShortQuery) {
        console.log(`🔤 Using hybrid search (RAG + Fuzzy matching) for better typo handling`);
        return await this.hybridSearch(searchQuery, resultLimit);
      }

      // For longer queries, use pure RAG (better for natural language)
      console.log(`🧠 Using pure RAG search for natural language query`);
      
      // Generate embedding for the search query
      const queryEmbedding = await ragService.generateEmbedding(searchQuery);
      const vectorString = `[${queryEmbedding.join(',')}]`;
      
      const sqlQuery = `
        SELECT 
          m.id,
          m.mrid,
          m.active_ingredient,
          m.strength,
          m.unit,
          m.dosage_form_parent,
          m.dosage_form_child,
          1 - (m.embedding <=> $1::vector) as similarity,
          (
            SELECT json_agg(json_build_object(
              'brand_name', mb.brand_name,
              'package_form', mb.package_form,
              'mb_mrid', mb.mb_mrid
            ))
            FROM medicine_brands mb
            WHERE mb.mrid = m.mrid
            LIMIT 5
          ) as brands,
          (
            SELECT json_agg(json_build_object(
              'code_type', mc.code_type,
              'code_value', mc.code_value
            ))
            FROM medicine_codes mc
            WHERE mc.mrid = m.mrid
          ) as codes
        FROM medicines m
        ORDER BY m.embedding <=> $1::vector
        LIMIT $2
      `;
      
      const result = await query(sqlQuery, [vectorString, resultLimit]);
      
      // Filter by similarity threshold
      const filteredResults = result.rows.filter(
        row => row.similarity >= this.similarityThreshold
      );
      
      console.log(`✅ Found ${filteredResults.length} medicines (threshold: ${this.similarityThreshold})`);
      
      return filteredResults.map(row => ({
        id: row.id,
        mrid: row.mrid,
        activeIngredient: row.active_ingredient,
        strength: row.strength,
        unit: row.unit,
        dosageForm: {
          parent: row.dosage_form_parent,
          child: row.dosage_form_child
        },
        similarity: parseFloat(row.similarity),
        brands: row.brands || [],
        codes: row.codes || []
      }));
      
    } catch (error) {
      console.error('❌ Error searching medicines:', error.message);
      throw error;
    }
  }

  /**
   * Get medicine by MRID
   * @param {string} mrid - Medicine Registration ID
   * @returns {Promise<object>} - Medicine details with brands and codes
   */
  async getMedicineByMRID(mrid) {
    try {
      console.log(`\n🔍 Getting medicine by MRID: ${mrid}`);
      
      const sqlQuery = `
        SELECT 
          m.id,
          m.mrid,
          m.active_ingredient,
          m.strength,
          m.unit,
          m.dosage_form_parent,
          m.dosage_form_child,
          m.created_at,
          m.updated_at,
          (
            SELECT json_agg(json_build_object(
              'id', mb.id,
              'brand_name', mb.brand_name,
              'package_form', mb.package_form,
              'mb_mrid', mb.mb_mrid
            ))
            FROM medicine_brands mb
            WHERE mb.mrid = m.mrid
          ) as brands,
          (
            SELECT json_agg(json_build_object(
              'id', mc.id,
              'code_type', mc.code_type,
              'code_value', mc.code_value
            ))
            FROM medicine_codes mc
            WHERE mc.mrid = m.mrid
          ) as codes
        FROM medicines m
        WHERE m.mrid = $1
      `;
      
      const result = await query(sqlQuery, [mrid]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      console.log(`✅ Medicine found: ${row.active_ingredient}`);
      
      return {
        id: row.id,
        mrid: row.mrid,
        activeIngredient: row.active_ingredient,
        strength: row.strength,
        unit: row.unit,
        dosageForm: {
          parent: row.dosage_form_parent,
          child: row.dosage_form_child
        },
        brands: row.brands || [],
        codes: row.codes || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
    } catch (error) {
      console.error('❌ Error getting medicine by MRID:', error.message);
      throw error;
    }
  }

  /**
   * Search medicine by specific code
   * @param {string} codeType - Type of code (MOH, NHIC, NUPCO, GTIN, REGISTRATION)
   * @param {string} codeValue - Code value to search
   * @returns {Promise<object>} - Medicine details
   */
  async getMedicineByCode(codeType, codeValue) {
    try {
      console.log(`\n🔍 Searching medicine by ${codeType} code: ${codeValue}`);
      
      // First find the MRID using the code
      const codeQuery = `
        SELECT mrid 
        FROM medicine_codes 
        WHERE code_type = $1 AND code_value = $2
        LIMIT 1
      `;
      
      const codeResult = await query(codeQuery, [codeType.toUpperCase(), codeValue]);
      
      if (codeResult.rows.length === 0) {
        console.log(`⚠️  No medicine found with ${codeType} code: ${codeValue}`);
        return null;
      }
      
      const mrid = codeResult.rows[0].mrid;
      
      // Get full medicine details
      return await this.getMedicineByMRID(mrid);
      
    } catch (error) {
      console.error('❌ Error searching by code:', error.message);
      throw error;
    }
  }

  /**
   * Get medicine details with AI-generated information
   * @param {string} mridOrId - Medicine MRID or database ID
   * @returns {Promise<object>} - Medicine details with AI information
   */
  async getMedicineWithAIInfo(mridOrId) {
    try {
      console.log(`\n🤖 Getting medicine with AI information: ${mridOrId}`);
      
      // Get basic medicine data
      let medicineData;
      
      // Check if it's a numeric ID or MRID format
      if (/^\d+$/.test(mridOrId)) {
        // It's a numeric ID, query by ID
        const result = await query(`
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            m.created_at,
            m.updated_at,
            (
              SELECT json_agg(json_build_object(
                'id', mb.id,
                'brand_name', mb.brand_name,
                'package_form', mb.package_form,
                'mb_mrid', mb.mb_mrid
              ))
              FROM medicine_brands mb
              WHERE mb.mrid = m.mrid
            ) as brands,
            (
              SELECT json_agg(json_build_object(
                'id', mc.id,
                'code_type', mc.code_type,
                'code_value', mc.code_value
              ))
              FROM medicine_codes mc
              WHERE mc.mrid = m.mrid
            ) as codes
          FROM medicines m
          WHERE m.id = $1
        `, [parseInt(mridOrId)]);
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        medicineData = {
          id: row.id,
          mrid: row.mrid,
          activeIngredient: row.active_ingredient,
          strength: row.strength,
          unit: row.unit,
          dosageForm: {
            parent: row.dosage_form_parent,
            child: row.dosage_form_child
          },
          brands: row.brands || [],
          codes: row.codes || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      } else {
        // It's an MRID
        medicineData = await this.getMedicineByMRID(mridOrId);
      }
      
      if (!medicineData) {
        console.log(`⚠️  Medicine not found: ${mridOrId}`);
        return null;
      }
      
      console.log(`✅ Medicine found: ${medicineData.activeIngredient}`);
      console.log(`🤖 Generating AI information using Goosedev/medbot...`);
      
      // Get AI-generated medical information
      const aiInfo = await medbotService.getMedicineInformation(medicineData);
      
      // Combine medicine data with AI information
      return {
        ...medicineData,
        aiInfo
      };
      
    } catch (error) {
      console.error('❌ Error getting medicine with AI info:', error.message);
      throw error;
    }
  }

  /**
   * Search medicines by active ingredient (text search)
   * @param {string} ingredient - Active ingredient name
   * @param {number} limit - Maximum number of results
   * @returns {Promise<array>} - Array of medicines
   */
  async searchByActiveIngredient(ingredient, limit = 20) {
    try {
      console.log(`\n🔍 Searching by active ingredient: ${ingredient}`);
      
      const sqlQuery = `
        SELECT 
          m.id,
          m.mrid,
          m.active_ingredient,
          m.strength,
          m.unit,
          m.dosage_form_parent,
          m.dosage_form_child,
          ts_rank(to_tsvector('english', m.active_ingredient), plainto_tsquery('english', $1)) as rank,
          (
            SELECT json_agg(json_build_object(
              'brand_name', mb.brand_name,
              'package_form', mb.package_form
            ))
            FROM medicine_brands mb
            WHERE mb.mrid = m.mrid
            LIMIT 5
          ) as brands
        FROM medicines m
        WHERE to_tsvector('english', m.active_ingredient) @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT $2
      `;
      
      const result = await query(sqlQuery, [ingredient, limit]);
      
      console.log(`✅ Found ${result.rows.length} medicines with ingredient: ${ingredient}`);
      
      return result.rows.map(row => ({
        id: row.id,
        mrid: row.mrid,
        activeIngredient: row.active_ingredient,
        strength: row.strength,
        unit: row.unit,
        dosageForm: {
          parent: row.dosage_form_parent,
          child: row.dosage_form_child
        },
        brands: row.brands || [],
        relevance: parseFloat(row.rank)
      }));
      
    } catch (error) {
      console.error('❌ Error searching by active ingredient:', error.message);
      throw error;
    }
  }

  /**
   * Search medicines by brand name
   * @param {string} brandName - Brand name to search
   * @param {number} limit - Maximum number of results
   * @returns {Promise<array>} - Array of medicines
   */
  async searchByBrandName(brandName, limit = 20) {
    try {
      console.log(`\n🔍 Searching by brand name: ${brandName}`);
      
      const sqlQuery = `
        SELECT 
          m.id,
          m.mrid,
          m.active_ingredient,
          m.strength,
          m.unit,
          m.dosage_form_parent,
          m.dosage_form_child,
          mb.brand_name,
          mb.package_form,
          mb.mb_mrid,
          ts_rank(to_tsvector('english', mb.brand_name), plainto_tsquery('english', $1)) as rank
        FROM medicines m
        JOIN medicine_brands mb ON m.mrid = mb.mrid
        WHERE to_tsvector('english', mb.brand_name) @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT $2
      `;
      
      const result = await query(sqlQuery, [brandName, limit]);
      
      console.log(`✅ Found ${result.rows.length} medicines with brand: ${brandName}`);
      
      return result.rows.map(row => ({
        id: row.id,
        mrid: row.mrid,
        activeIngredient: row.active_ingredient,
        strength: row.strength,
        unit: row.unit,
        dosageForm: {
          parent: row.dosage_form_parent,
          child: row.dosage_form_child
        },
        brandName: row.brand_name,
        packageForm: row.package_form,
        mbMrid: row.mb_mrid,
        relevance: parseFloat(row.rank)
      }));
      
    } catch (error) {
      console.error('❌ Error searching by brand name:', error.message);
      throw error;
    }
  }

  /**
   * Hybrid search: Combines RAG semantic search with fuzzy text matching
   * Handles typos and misspellings better
   * @param {string} searchQuery - Search query
   * @param {number} limit - Maximum results
   * @returns {Promise<array>} - Combined and deduplicated results
   */
  async hybridSearch(searchQuery, limit) {
    try {
      // 1. RAG Search (semantic)
      const queryEmbedding = await ragService.generateEmbedding(searchQuery);
      const vectorString = `[${queryEmbedding.join(',')}]`;
      
      // 2. Multi-tier search with proper prioritization:
      // Priority 1: Exact active ingredient match (1.0)
      // Priority 2: Active ingredient starts with query (0.95)
      // Priority 3: Active ingredient contains query as whole word (0.92)
      // Priority 4: Active ingredient contains query anywhere (0.88)
      // Priority 5: Brand name exact match (0.85)
      // Priority 6: Brand name starts with query (0.80)
      // Priority 7: Brand name contains query (0.75)
      // Priority 8: RAG semantic similarity (actual score, max 0.70)
      const combinedQuery = `
        WITH exact_ingredient AS (
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            1.0 as similarity,
            'exact_ingredient' as source
          FROM medicines m
          WHERE LOWER(m.active_ingredient) = LOWER($3)
        ),
        starts_with_ingredient AS (
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            0.95 as similarity,
            'starts_ingredient' as source
          FROM medicines m
          WHERE LOWER(m.active_ingredient) LIKE LOWER($4)
            AND LOWER(m.active_ingredient) != LOWER($3)
        ),
        word_boundary_ingredient AS (
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            0.92 as similarity,
            'word_ingredient' as source
          FROM medicines m
          WHERE (
            LOWER(m.active_ingredient) LIKE LOWER($6)
            OR LOWER(m.active_ingredient) LIKE LOWER($7)
            OR LOWER(m.active_ingredient) LIKE LOWER($8)
          )
          AND LOWER(m.active_ingredient) NOT LIKE LOWER($4)
        ),
        contains_ingredient AS (
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            0.88 as similarity,
            'contains_ingredient' as source
          FROM medicines m
          WHERE LOWER(m.active_ingredient) LIKE LOWER($5)
            AND LOWER(m.active_ingredient) NOT LIKE LOWER($4)
            AND NOT (
              LOWER(m.active_ingredient) LIKE LOWER($6)
              OR LOWER(m.active_ingredient) LIKE LOWER($7)
              OR LOWER(m.active_ingredient) LIKE LOWER($8)
            )
        ),
        exact_brand AS (
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            0.85 as similarity,
            'exact_brand' as source
          FROM medicines m
          JOIN medicine_brands mb ON m.mrid = mb.mrid
          WHERE LOWER(mb.brand_name) = LOWER($3)
        ),
        starts_with_brand AS (
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            0.80 as similarity,
            'starts_brand' as source
          FROM medicines m
          JOIN medicine_brands mb ON m.mrid = mb.mrid
          WHERE LOWER(mb.brand_name) LIKE LOWER($4)
            AND LOWER(mb.brand_name) != LOWER($3)
        ),
        contains_brand AS (
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            0.75 as similarity,
            'contains_brand' as source
          FROM medicines m
          JOIN medicine_brands mb ON m.mrid = mb.mrid
          WHERE LOWER(mb.brand_name) LIKE LOWER($5)
            AND LOWER(mb.brand_name) NOT LIKE LOWER($4)
        ),
        rag_results AS (
          SELECT 
            m.id,
            m.mrid,
            m.active_ingredient,
            m.strength,
            m.unit,
            m.dosage_form_parent,
            m.dosage_form_child,
            LEAST(1 - (m.embedding <=> $1::vector), 0.70) as similarity,
            'rag' as source
          FROM medicines m
          ORDER BY m.embedding <=> $1::vector
          LIMIT $2
        ),
        combined_results AS (
          SELECT * FROM exact_ingredient
          UNION ALL
          SELECT * FROM starts_with_ingredient
          UNION ALL
          SELECT * FROM word_boundary_ingredient
          UNION ALL
          SELECT * FROM contains_ingredient
          UNION ALL
          SELECT * FROM exact_brand
          UNION ALL
          SELECT * FROM starts_with_brand
          UNION ALL
          SELECT * FROM contains_brand
          UNION ALL
          SELECT * FROM rag_results
        ),
        aggregated AS (
          SELECT 
            id, mrid, active_ingredient, strength, unit,
            dosage_form_parent, dosage_form_child,
            MAX(similarity) as similarity,
            array_agg(DISTINCT source) as sources
          FROM combined_results
          GROUP BY id, mrid, active_ingredient, strength, unit, dosage_form_parent, dosage_form_child
        )
        SELECT * FROM aggregated
        ORDER BY similarity DESC, active_ingredient ASC
        LIMIT $2
      `;
      
      const result = await query(combinedQuery, [
        vectorString,                // $1: embedding vector
        limit,                       // $2: limit
        searchQuery,                 // $3: exact match
        `${searchQuery}%`,           // $4: starts with
        `%${searchQuery}%`,          // $5: contains anywhere
        `% ${searchQuery}%`,         // $6: word boundary (space before)
        `% ${searchQuery} %`,        // $7: complete word (spaces both sides)
        `%${searchQuery}`            // $8: ends with query
      ]);
      
      console.log(`✅ Hybrid search found ${result.rows.length} medicines`);
      
      // Get brands and codes for each medicine
      const enrichedResults = await Promise.all(
        result.rows.map(async (row) => {
          const brandsQuery = await query(`
            SELECT brand_name, package_form, mb_mrid
            FROM medicine_brands
            WHERE mrid = $1
            LIMIT 5
          `, [row.mrid]);
          
          const codesQuery = await query(`
            SELECT code_type, code_value
            FROM medicine_codes
            WHERE mrid = $1
          `, [row.mrid]);
          
          return {
            id: row.id,
            mrid: row.mrid,
            activeIngredient: row.active_ingredient,
            strength: row.strength,
            unit: row.unit,
            dosageForm: {
              parent: row.dosage_form_parent,
              child: row.dosage_form_child
            },
            similarity: parseFloat(row.similarity),
            brands: brandsQuery.rows,
            codes: codesQuery.rows,
            matchedBy: row.sources // Shows if found by RAG, fuzzy, or brand search
          };
        })
      );
      
      return enrichedResults;
      
    } catch (error) {
      console.error('❌ Error in hybrid search:', error.message);
      throw error;
    }
  }

  /**
   * Get medicine statistics
   * @returns {Promise<object>} - Statistics about medicines in the database
   */
  async getStatistics() {
    try {
      const statsQueries = [
        query('SELECT COUNT(*) as total FROM medicines'),
        query('SELECT COUNT(*) as total FROM medicine_brands'),
        query('SELECT code_type, COUNT(*) as count FROM medicine_codes GROUP BY code_type'),
        query('SELECT dosage_form_parent, COUNT(*) as count FROM medicines GROUP BY dosage_form_parent ORDER BY count DESC LIMIT 10')
      ];
      
      const [medicinesResult, brandsResult, codesResult, dosageFormsResult] = await Promise.all(statsQueries);
      
      return {
        totalMedicines: parseInt(medicinesResult.rows[0].total),
        totalBrands: parseInt(brandsResult.rows[0].total),
        codeTypes: codesResult.rows.reduce((acc, row) => {
          acc[row.code_type] = parseInt(row.count);
          return acc;
        }, {}),
        topDosageForms: dosageFormsResult.rows.map(row => ({
          dosageForm: row.dosage_form_parent,
          count: parseInt(row.count)
        }))
      };
      
    } catch (error) {
      console.error('❌ Error getting statistics:', error.message);
      return {
        totalMedicines: 0,
        totalBrands: 0,
        codeTypes: {},
        topDosageForms: [],
        error: error.message
      };
    }
  }

  /**
   * Update configuration
   * @param {object} config - Configuration object
   */
  updateConfig(config) {
    if (config.similarityThreshold !== undefined) {
      this.similarityThreshold = config.similarityThreshold;
      console.log(`📊 Updated similarity threshold: ${this.similarityThreshold}`);
    }
    
    if (config.maxResults !== undefined) {
      this.maxResults = config.maxResults;
      console.log(`📊 Updated max results: ${this.maxResults}`);
    }
  }

  /**
   * Get current configuration
   * @returns {object} - Current configuration
   */
  getConfig() {
    return {
      similarityThreshold: this.similarityThreshold,
      maxResults: this.maxResults
    };
  }
}

// Export singleton instance
export default new MedicineService();

