Error Group	Abbreviation	 Description 
Incorrect DataType	 Rules related to element data type 	DT
FHIR-R4 Rule	 FHIR-R4 base rules 	FR
Incorrect Binding	 Rules related to the element and valueSet binding for predefined values 	IB
Incorrect Cardinality	 Rules related to element cardinality as per the Nphies profiles 	IC
Reference to SubProfile	 Rules related to resource structure definintions, extensions and internal resource referencing 	RE
General Error	 General errors 	GE
Business and Validation Rule	 Nphies business and validation rules 	BV
		
Field Description		
		
Field Description	Description	 Sample 
Rule ID	Unique rule identifier	BV-00001
Rule Type	Type of rule as per the rule groups above	BV
Rule Related Message/Resource/Element	Element, Resource, Profile or Information payload related to the rule	CoverageEligibilityResponse.insurance.extension.notInForceReason
Rule Description	Rule technical description	File size must not exceed 10 MB
Rule Display	User friendly message describing the rule	Message payload is greater than the maximum allowed size (10 MB)
TMB Version	The TMB Version in which the rule is impacted (added/updated/deactivated/reactivated)	v1.2.875
Rule Publishing Date	Date (YYYYMMDD) when the rule is added to the BRVR document	20210101
Rule Update Date	Date (YYYYMMDD) when the rule is updated in the BRVR document	20210210
Rule Deactivation date	Date (YYYYMMDD)  when the rule is marked as deactivated in the BRVR document	20210321
OBA Release Date	Date (YYYYMMDD)  when the rule had been released to the OBA (onboarding) environment	20220829
Production Release Date	Date (YYYYMMDD)  when the rule is deployed on the Prodcution environment	20220906
