```
0
```
# nphies Shadow Billing Guideline

## Version 1. 7

## 11 April 2022


## TABLE OF CONTENTS

- Abbreviations
- Document Release Note
- Section 1.0 Shadow Billing
- Section 2.0 Package Mapping and Billing
      - 2.1 Current Situation
      - 2.2 Mapping Solution.......................................................................................................
      - 2.3 Package Billing
      - 2.3.1 Package Billing Examples:
      - 2.4 Detailed Shadow Billing Guidelines for Packages
      - 2.4.1 In-Patient (IP) Appendectomy Package
      - 2.5 Reporting in nphies
      - 2.6 Additional Package Shadow Billing Examples
      - 2.6.1 In-Patient (IP) Caesarean Section package and Salpingotomy
      - 2.6.2 In-Patient (IP) Partial lobectomy of brain package and Electroencephalography
   - 2.6.3 Out-Patient (OP) Root Canal Treatment (3 Roots) with Filling
- Section 3.0 Fee-For-Service Non-Standard Codes Mapping and Billing
   - 3.1 Current Situation
   - 3.2 Mapping Solution.....................................................................................................
   - 3.3 Item Billing
   - 3.3.1 Item Billing Examples:
   - 3.4 Reporting in nphies
- Section 4.0 Application of Shadow Billing
   - 4.1 Many to One Mapping of Services
   - 4.2 GMDN – Medical Devices and Consumables
   - 4.3 GTIN – Medication
   - 4.4 Outpatient: ADA-Australian Dental Association
   - 4.5 Unlisted Item Codes
- Section 5.0 JSON Sample Messaging
   - 5.1 Package Sample Messaging – IP Appendectomy
   - Salpingotomy 5.2 Package Sample Messaging – In-Patient (IP) Caesarean Section package and
   - Electroencephalography 5.3 Package Sample Messaging – IP In-Patient (IP) Partial lobectomy of brain package and
   - Filling 5.4 Package Sample Messaging – Out-Patient (OP) Root Canal Treatment (3 Roots) with
   - 5.5 Non-Standard Code Fee-For-Service Sample Messaging


## Abbreviations

```
Abbreviation Description
nphies National Platform for Health Information Exchange Services
CHI Council of Health Insurance
SBS Saudi Billing System
HIC Health Insurance Company
HCP HealthCare Provider
TPA Third Party Administrator
```

## Document Release Note

##### REVISION HISTORY

```
Document
Version
Number
```
```
Date of
Release
```
```
Details of Changes Section
No.(s)
```
```
1.0 7 - Oct- 20 Created the first version to be published. All Sections
applicable
1.1 13 - Nov- 20 Section 2.2 ACHI code replaced with SBS code
Section 2.3 ACHI code replaced with SBS code
Section 3.2 ACHI code replaced with SBS code
Section 4.4 NHIC with Saudi Extensions – Imagining
Procedures removed
Section 4.5 Outpatient: ADA-Australian Dental Association
Unlisted code updated.
Section 4.6 Unlisted Item Codes – NHIC Unlisted code
removed.
Section 5.0 JSON Sample Messaging – Message sample
updated
```
```
Sections:
2.
2.
3.
4.
4.
4.
5.
```
```
1.2 5 - Dec- 20 Section 6.1 Unlisted Item Codes
Description of SBS code 99999 - 99 - 99 updated to Unlisted
Procedure Code
Addition of 99999 - 99 - 91 – Unlisted Dental Procedure Code
Addition of 99999 - 99 - 92 – Unlisted Imaging Code
```
```
6.
```
```
1.3 24 - Jan- 21 Additional Package Shadow Billing scenarios added:
Section 2.5.1 In-Patient (IP) Caesarean Section package and
Salpingotomy
Section 2.5.2 In-Patient (IP) Partial lobectomy of brain package
and Electroencephalography
Section 2.5.3 Out-Patient (OP) Root Canal Treatment (3 Roots)
with Filling
```
```
Additional Package Shadow Billing scenarios JSON sample
messages added:
Section 5.2 In-Patient (IP) Caesarean Section package and
Salpingotomy
Section 5.3 In-Patient (IP) Partial lobectomy of brain package
and Electroencephalography
Section 5.4 Out-Patient (OP) Root Canal Treatment (3 Roots)
with Filling
```
```
2.5.
2.5.
2.5.
5.
5.
5.
```
```
1.4 22 - Mar- 21 Updated JSON sample messages in line with TMB changes
v1.2.8 6
```
```
5.
5.
5.
5.
5.
1.5 1 - Jun- 21 Updated instructions for GTIN - Medication 4.
1.6 22 - Aug- 21 Added a summary of Shadow billing guidelines 2.
1.7 11 - Apr- 22 Package Billing 2.
```

Reporting in nphies
Item Billing
Reporting in nphies
Unlisted Item Codes

```
2.
3.
3.
4.
```

## Section 1.0 Shadow Billing

Shadow billing is a methodology that will ultimately provide all market participants with visibility during the
transition period from billing using non-standard to standardized coding.

Following the implementation of the nphies system, Shadow Billing will allow Healthcare Providers (HCPs) to
continue to communicate with Health Insurance Companies (HICs) and Third-Party Administrators (TPAs) using
both the nphies standard codes and their previously contracted non standardized codes to maintain the same
level of information exchange and reduce the impact on claim payment that may come from errors in mapping.

This methodology laid out in this guideline will also allow Health Insurance Companies (HICs) and Third-Party
Administrators (TPAs) to validate the mapping completed by Healthcare Providers (HCPs) on an individual
transaction basis as transactions will include the nphies standard code for each item as well as its previously
used non-standard code. The application of Shadow Billing can apply to both the Authorization and Claim
transactions.

The validation process of such mapping is expected to be a continuous process that will be Health Insurance
Companies (HICs) and Third-Party Administrators (TPAs) driven, with feedback and adjustments to mapping
being shared over time with Healthcare Providers (HCPs).


## Section 2.0 Package Mapping and Billing

#### 2.1 Current Situation

Prior to implementation of nphies, health service Packages were agreed between Health Insurance Companies
(HICs)/Third-Party Administrators (TPAs) and Healthcare Providers (HCPs) and used to refer to a group of
services. Each package has an agreed contractual price.

Package codes are not standardized among Healthcare Providers (HCPs) and include different services
performed under the umbrella of the package.

In the context of nphies, the individual services within a package are referred to as items.

#### 2.2 Mapping Solution.......................................................................................................

This section provides a summary of this document. The shadow billing is a methodology that will ultimately
provide all market participants with visibility during the transition period from billing using non-standard to
standardized coding, which both the non-standard and standard codes should be included within the nphies
transactions.

Below is a summary on how to use shadow billing in Pre-Authorization and Claims packages.

#### 2.3 Package Billing

To bill packaged items, you will need to perform two main activities: Mapping then Billing.

Mapping:

1 - Map non-standard package code to a nphies code, which will be used as reference to describe your
package in nphies platform.
IF no nphies code can be used as description of your package
THEN map it to Unlisted Code (E.g., 99999 - 99 - 99 Unlisted Procedure Code)
2 - Map individual items within the package to nphies codes, and if they do not match any of nphies codes use
suitable unlisted nphies codes from the codes listed in section 4.5.

Billing:

1 - Flag your transactions that contain a package. Technical details on flagging can be found in section 2. 5.
2 - Enter your mapped reference code, with package amount.
3 - Enter the individual items of the package one-by-one using nphies codes or unlisted codes, with Zero
amounts.

#### 2.3.1 Package Billing Examples:

Example of Package billing:

```
▪ Package code: Append332 (we refer to it as reference code)
▪ Package description: In-Patient (IP) Appendicectomy package.
▪ Package price: 2,400 SAR
```

```
▪ Package Items:
```
Service code/Non
Standard Item Code

```
Item Name nphies Code list
name
```
```
nphies
Standard Code
```
```
nphies Standard Service
Name
```
```
Price
```
```
442 Lab Blood group Saudi Billing System
(SBS)
```
73250 - 00 - (^80) BLOOD GROUP 0
889 Anesthesia Saudi Billing System
(SBS)
83670 - 00 - (^60) Anesthesia Services Per Unit 0
776 Procedure fees Saudi Billing System
(SBS)
30571 - 00 - (^00) Appendicectomy 0
554 X-Ray Saudi Billing System
(SBS)
58900 - 00 - 90 Radiography of abdomen 0
552 Drug SFDA_GTIN / SFDA
Registration No
06285097000049 AUGMENTIN 1.2GM VIAL 0
500 Consumables SFDA (GMDN) 47203 Wound-nonadherent dressing,
permeable, antimicrobial
0
011 Room and Board Saudi Billing System
(SBS)
83610 - 01 - 00 Room and Board: Per Diem -
First Class Room
0

#### 2.4 Detailed Shadow Billing Guidelines for Packages

```
The non-standard service code for a package code must be mapped to an existing code from nphies standard
code lists. This code may not be exactly corresponding to the package but will be used as reference to report
the package in nphies platform and can be any code from one of the nphies code sets.
```
```
For reporting the individual items within a package Healthcare Providers (HCPs) must map each non-standard
service code to the corresponding nphies standard code.
```
```
Transactions that contain a package must be flagged by Healthcare Providers (HCPs). Details of this flag can
be found in section 2. 5.
```
#### 2.4.1 In-Patient (IP) Appendectomy Package

```
Provider A has an In-Patient (IP) Appendectomy package with internal code Append33 2 , with contracted price
2,400 SAR. Provider A has chosen to map this package to the corresponding SBS Procedure code for IP
Appendicectomy Appendectomy - 30571 - 00 - 00.
```
```
▪ Package code: Append
▪ Package price: 2,400 SAR
▪ Package description: In-Patient (IP) Appendicectomy package.
```

```
▪ Package Items:
```
```
Service code/Non-Standard
Item Code
```
```
Item Name
```
```
442 Lab Blood group
889 Anesthesia
776 Procedure fees
554 X-Ray
552 Drug
500 Consumables
011 Room and Board
```
Provider A has also mapped the individual package non-standard item codes to the corresponding code from
the nphies standard code lists.

```
Service code/Non
Standard Item
Code
```
```
Item Name nphies Code list
name
```
```
nphies
Standard
Code
```
```
nphies Standard Service
Name
```
```
442 Lab Blood group Saudi Billing
System (SBS)
```
73250 - 00 - (^80) BLOOD GROUP
889 Anesthesia Saudi Billing
System (SBS)
83670 - 00 - (^60) Anesthesia Services Per Unit
776 Procedure fees Saudi Billing
System (SBS)
30571 - 00 - (^00) Appendicectomy
554 X-Ray Saudi Billing
System (SBS)
58900 - 00 - 90 Radiography of abdomen
552 Drug SFDA_GTIN /
SFDA Registration
No
06285097000049 AUGMENTIN 1.2GM VIAL
500 Consumables SFDA (GMDN) 47203 Wound-nonadherent dressing,
permeable, antimicrobial
011 Room and Board Saudi Billing
System (SBS)
83610 - 01 - 00 Room and Board: Per Diem -
First Class Room

#### 2.5 Reporting in nphies

The reporting scenario described below can apply to both the Authorization and Claim transactions.

```
a. Claim.item.extension.package field:
```
```
This field should be added in the transaction and set to true to enable shadow billing for this package.
```
```
b. Claim.item.productOrService field:
```
```
This field will contain both package codes:
```
```
▪ nphies mapped code: ( 30571 - 00 - 00 ) - This code should correspond to one nphies standard code or
unlisted codes (listed in section 4.5) and nphies Business and Validation Rules (BRVRs) will apply
to this field. In this example the corresponding code is from nphies standard codes (e.g., Saudi
Billing System).
```
```
▪ HCP non-standard package code: (Append332) - nphies Business and Validation Rules (BRVRs)
will not be applied on the non-standard package code.
```

```
▪ Package net price is to be reported in this field as contractually agreed.
```
```
c. Claim.item.detail.productOrService fields:
```
```
These fields will contain the list of item package codes as per the nphies standard code or unlisted
codes (listed in section 4.5).
```
```
▪ Healthcare Providers (HCPs) must only include items which were rendered and not report, by
default, all items within the package.
```
```
▪ Items.detail or package item will have zero amount as price (item.detail.net = 0).
```
#### 2.6 Additional Package Shadow Billing Examples

#### 2.6.1 In-Patient (IP) Caesarean Section package and Salpingotomy

Provider A has an In-Patient (IP) Caesarean Section package with internal code Caesarean001, with contracted
price 10,000 SAR. Provider A has chosen to map this package to the corresponding SBS Procedure code for IP
Elective Caesarean Section - Elective classical caesarean section - 16520 - 00 - 00.
During the same admission, additional procedure was done on Fallopian Tubes as Salpingotomy. Provider A
has chosen to map this code to the corresponding SBS Procedure Code - Salpingotomy - 35713 - 12 - 00 , which
is not part of the package and is to be billed separately.
▪ Package code: Caesarean
▪ Package price: 10,000 SAR
▪ Package description: In-Patient (IP) Caesarean Section package.
▪ Package Items:

```
Service code/Non-
Standard Item Codes
included in the package
```
- Caesarean

```
Item Name
```
```
442 Lab Blood group
889 Anesthesia
776 Procedure fees - Elective Caesarean Section package
552 Drug
500 Consumables^
011 Room and Board
```
```
▪ Additional Item code: 770
▪ Additional Item Price: 1,000 SAR
```
```
Service code/Non-Standard Item Codes
for additional procedure - Salpingotomy
```
```
Item Name
```
```
770 Salpingotomy
```

Provider A has mapped the individual package non-standard item codes to the corresponding code from the
nphies standard code lists as well as additional procedure code to corresponding nphies code

```
Service code/Non
Standard Item
Code
```
```
Item Name nphies Code list
name
```
```
nphies
Standard
Code
```
```
nphies Standard Service
Name
```
```
442 Lab Blood group Saudi Billing
System (SBS)
```
73250 - 00 - (^80) BLOOD GROUP
889 Anesthesia Saudi Billing
System (SBS)
83670 - 00 - (^60) Anesthesia Services Per Unit
776 Procedure fees -
Elective
Caesarean
Section package
Saudi Billing
System (SBS)
16520 - 00 - (^00) Elective classical caesarean
section
552 Drug SFDA_GTIN /
SFDA Registration
No)
06285097000049 AUGMENTIN 1.2GM VIAL
500 Consumables SFDA (GMDN) 47203 Wound-nonadherent dressing,
permeable, antimicrobial
011 Room and Board Saudi Billing
System (SBS)
83610 - 01 - 00 Room and Board: Per Diem -
First Class Room
770 Salpingotomy Saudi Billing
System (SBS)
35713 - 12 - 00 Salpingotomy

#### 2.6.2 In-Patient (IP) Partial lobectomy of brain package and Electroencephalography

Provider A has an In-Patient (IP) Partial lobectomy of brain package with internal code Brain001, with
contracted price 20,000 SAR. Provider A has chosen to map this package to the corresponding SBS Procedure
code for IP Elective Partial lobectomy of brain - Elective Partial lobectomy of brain - 40703 - 02 - 00
During the same admission, additional procedure was done as Electroencephalography. Provider A has chosen
to map this code to the corresponding SBS Procedure Code - Electroencephalography 11000 - 00 - 00, which is
not part of the package and is to be billed separately.

```
▪ Package code: Brain
▪ Package price: 20,000 SAR
▪ Package description: In-Patient (IP) Partial lobectomy of brain package.
▪ Package Items:
```
```
Service code/Non-Standard Item
Codes included in the package -
Brain
```
```
Item Name
```
```
442 Lab Blood group
889 Anesthesia
650 Procedure fees - Partial lobectomy of brain package
552 Drug
330 Tomography of brain
500 Consumables^
011 Room and Board^
```
```
▪ Additional Item code: 335
▪ Additional Item Price: 1,000 SAR
```
```
Service code/Non-Standard Item Codes for
additional procedure - Electroencephalography
```
```
Item Name
```
```
335 Electroencephalography
```

Provider A has also mapped the individual package non-standard item codes to the corresponding code from
the nphies standard code lists as well as additional procedure code to corresponding nphies code

```
Service code/Non
Standard Item
Code
```
```
Item Name nphies
Code list
name
```
```
nphies
Standard
Code
```
```
nphies Standard Service
Name
```
```
442 Lab Blood group Saudi Billing
System (SBS)
```
73250 - 00 - (^80) BLOOD GROUP
889 Anesthesia Saudi Billing
System (SBS)
83670 - 00 - (^60) Anesthesia Services Per Unit
650 Procedure fees - Partial
lobectomy of brain
package
Saudi Billing
System (SBS)
40703 - 02 - (^00) Elective Partial lobectomy of
brain
330 Tomography of brain Saudi Billing
System (SBS)
56001 - 00 - 00 Computerised tomography of
brain
552 Drug SFDA_GTIN /
SFDA
Registration
No)
06285097000049 AUGMENTIN 1.2GM VIAL
500 Consumables SFDA
(GMDN)
47203 Wound-nonadherent dressing,
permeable, antimicrobial
011 Room and Board Saudi Billing
System (SBS)
83610 - 01 - 00 Room and Board: Per Diem -
First Class Room
335 Electroencephalography Saudi Billing
System (SBS)
11000 - 00 - 00 Electroencephalography

### 2.6.3 Out-Patient (OP) Root Canal Treatment (3 Roots) with Filling

Provider A has a Dental Procedure ROOT CANAL TREATMENT (3 CANALS) WITH FILLING with internal code
DEN001, with contracted price 2000 SAR. Provider A has chosen to map this code to the corresponding SBS
Procedure code for Root Canal - Complete chemo-mechanical preparation of root canal one canal- 415

```
▪ Package code: DEN
▪ Package price: 2,000 SAR
▪ Package description: ROOT CANAL TREATMENT (3 CANALS) WITH FILLING.
▪ Package Items:
```
```
Service code/Non-Standard Item
Codes included in the package –
DEN
```
```
Item Name
```
```
001 Root Canal Treatment 1 Canal
002 Root Canal Treatment Additional Canal
002 Root Canal Treatment Additional Canal
003 Filling after Root Canal Treatment
```

Provider A has also mapped the individual package non-standard item codes to the corresponding code from
the nphies standard code lists

```
Service code/Non
Standard Item
Code
```
```
Item Name nphies
Code list
name
```
```
nphies
Standard
Code
```
```
nphies Standard Service
Name
```
```
001 Root Canal Treatment
1 Canal
```
```
ADA Codes 415*1^ Complete chemo-mechanical
preparation of root canal one
canal
002 Root Canal Treatment
Additional Canal
```
```
ADA Codes 416*2^ Complete chemo-mechanical
preparation of root canal each
additional canal
003 Filling after Root Canal
Treatment
```
```
ADA Codes 533 *1^ Adhesive restoration three
surfaces posterior tooth direct
```

## Section 3.0 Fee-For-Service Non-Standard Codes Mapping and Billing

### 3.1 Current Situation

Prior to implementation of nphies, non-standardized service codes were agreed between Health Insurance
Companies (HICs)/Third Party Administrators (TPAs) and Healthcare Providers (HCPs) with a contractually
agreed price.

With the application of nphies standard codes and unification of service codes across the KSA market,
Healthcare Providers (HCPs) are required to map their existing contracted services to the corresponding nphies
standard codes.

### 3.2 Mapping Solution.....................................................................................................

This guideline is provided to facilitate the transition from non-standard to standard billing codes for Health
Insurance Companies (HICs)/Third Party Administrators (TPAs) and Healthcare Providers (HCPs).

For a Healthcare Provider (HCP) billing using the fee-for-service model and billing for each individual item, each
item code should be mapped to the corresponding code from the nphies standard code lists.

Both the non-standard and standard codes should be included within the nphies transactions.

### 3.3 Item Billing

To bill an item, you will need to perform two main activities: Mapping then Billing.

Mapping:
Look for a nphies code that matches the description of your non-standard service code:
IF no code matches the same description
THEN map it to a similar code
IF no similar code exists in nphies codes
THEN map it to Unlisted Code of the same category (listed in section 4.5).

Billing:

1 - Flag your transactions that contain an item. Technical details on flagging can be found in section 3. 4.
2 - Enter both the non-standard and standard codes of the item within the transactions.
3 - Enter the item amount.

### 3.3.1 Item Billing Examples:

```
Service code/Non
Standard Item
Code
```
```
Item Name nphies Code
list name
```
```
nphies
Standard
Code
```
```
nphies Standard
Service Name
```
```
Price
```
```
442 Lab Blood group Saudi Billing
System (SBS)
```
73250 - 00 - 80 BLOOD GROUP (^200)
889 Anesthesia Saudi Billing
System (SBS)
83670 - 00 - 60 Anesthesia Services Per
Unit 400
776 Procedure fees Saudi Billing
System (SBS)
30571 - 00 - (^00) Appendicectomy (^1200)


```
554 X-Ray Saudi Billing
System (SBS)
```
```
58900 - 00 - 90 Radiography of abdomen 200
```
```
552 Drug SFDA (GTIN) 06285097000049 AUGMENTIN 1.2GM
VIAL
```
```
100
```
```
500 Consumables SFDA_GMDN /
SFDA
Registration
No)
```
```
47203 Wound-nonadherent
dressing, permeable,
antimicrobial
```
```
100
```
```
011 Room and Board Saudi Billing
System (SBS)
```
```
83610 - 01 - 00 Room and Board: Per
Diem - First Class Room
```
```
1000
```
### 3.4 Reporting in nphies

The same scenario described below can apply to both the Authorization and Claim transactions.

```
a. Claim.item.extension.package field:
```
```
This field should be added in the transaction and set to false to identify that this item is not part of a
package.
```
```
b. Claim.item.productOrService field
```
```
This field will contain:
```
```
▪ nphies mapped code: ( 73250 - 00 - 80 ) - This code should correspond to one nphies standard code or
unlisted codes (listed in section 4.5) and nphies Business and Validation Rules (BRVRs) will apply
to this field. In this example the corresponding code is from the nphies standard code (e.g., Saudi
Billing System (SBS)).
```
```
▪ Provider internal lab blood group code: (442) - nphies Business and Validation Rules (BRVRs) will
not be applied on the non-standard code
```
```
▪ Item net price is to be reported in this field as contractually agreed.
```

## Section 4.0 Application of Shadow Billing

The application of shadow billing supports the shift from non-standardized coding to standardized coding, while
allowing for validation.

### 4.1 Many to One Mapping of Services

As with any implementation of a unified billing system in a given market, the adoption of standardized code sets
may require customization of some item codes. Some Healthcare Providers (HCPs) may encounter difficulties
in mapping for some items where a “one to one” mapping cannot be found.

When encountered with “many to one” mapping scenarios, shadow billing serves to maintain an adequate level
of granularity by allowing the previously used non-standard code to be included in the nphies transaction,
thereby maintaining the same level of communication until a permanent coding solution can be applied.

The fee-for-service reporting laid out in section 3.3 is to be implemented for mapping an item with a non-
standardized code that cannot be mapped to a corresponding code from the nphies Clinical Standard code lists
with the same description. It is recommended that these items be mapped to a similar code and description
from the nphies Clinical Standard code lists. The inclusion of the non-standard code within the transaction will
maintain the granularity level and detail

### 4.2 GMDN – Medical Devices and Consumables

The fee-for-service reporting laid out in section 3. 3 is to be implemented for mapping an item with a non-
standardized code that cannot be mapped to a corresponding GMDN _–_ Medical Devices and Consumables
code with the same description. In this scenario, the Healthcare Provider (HCP) must map such items to the
SFDA-GMDN code - 99999 - Unlisted Item.

### 4.3 GTIN – Medication

The fee-for-service reporting laid out in section 3. 3 is to be implemented for billing of any imported medications
and medications with an SFDA Registration ID that does not have a corresponding GTIN - Medication code. In
this scenario, the Healthcare Provider (HCP) must map such items to the suitable SFDA-GTIN code from the
codes listed in section 4.5.

The exception to this is for Herbals / Vitamins where SFDA Registration ID can be used if available. Eventually
once Herbals and Vitamins will have GTIN codes, it will be required to use GTIN codes for herbals and vitamins
too).

### 4.4 Outpatient: ADA-Australian Dental Association

The fee-for-service reporting laid out in section 3.3 is to be implemented for mapping an item with a non-
standardized code that cannot be mapped to a corresponding ADA-Australian Dental Association code with the
same description. It is recommended that these items be mapped to a similar ADA-Australian Dental
Association code and description. The inclusion of the non-standard code within the transaction will maintain
the granularity level and detail.

A Healthcare Provider (HCP) may find that there are items that cannot be mapped to a similar ADA-Australian
Dental Association code and description. In this scenario, the Healthcare Provider (HCP) must map such items
to the ADA-Australian Dental Association code – 9999 - Unlisted Out-Patient Dental Code. The inclusion of
the non-standard code within the transaction will maintain the granularity level and detail.


### 4.5 Unlisted Item Codes

The Table below displays the Unlisted Item codes that currently exist within the nphies Clinical Standards Code
Lists and are recommended for use only for an item with a non-standardized code that cannot be mapped to a
corresponding code from the nphies Clinical Standard code lists with the same or similar description.

```
nphies Code Long Description Type
83500 - 00 - 80 Unlisted ambulance service Transportation (SBS)
83700 - 00 - 00 Unlisted services yet to be defined KSA service codes (SBS)
99999 - 99 - 99 Unlisted procedure code Procedures (SBS)
99999 - 99 - 91 Unlisted dental procedure code Dental (SBS)
99999 - 99 - 92 Unlisted imaging code Imaging (SBS)
73050 - 39 - 70 Unlisted chemistry tests Laboratory (SBS)
73100 - 09 - 80 Unlisted hematology and coagulation procedure Laboratory (SBS)
73150 - 01 - 20 Unlisted urinalysis Laboratory (SBS)
73200 - 03 - 60 Unlisted cytopathology procedure Laboratory (SBS)
73200 - 10 - 60 Unlisted surgical pathology procedure Laboratory (SBS)
73250 - 03 - 80 Unlisted transfusion medicine procedure Laboratory (SBS)
73350 - 06 - 00 Unlisted molecular pathology procedure Laboratory (SBS)
73400 - 00 - 40 Unlisted in vivo laboratory services Laboratory (SBS)
73400 - 05 - 10 Unlisted reproductive medicine laboratory procedure Laboratory (SBS)
99999999999991 Unlisted nutritional supplements (Other nutritional substitute) SFDA_GTIN
99999999999992 Unlisted nutritional supplements (Enteral feeds) SFDA_GTIN
99999999999993 Unlisted other non-medications SFDA_GTIN
99999999999994 Unlisted nutritional supplements (Mother’s milk substitute (baby/infant formula) SFDA_GTIN
99999999999995 Unlisted cosmetic SFDA_GTIN
99999999999996 Unlisted herbal and vitamins SFDA_GTIN
99999999999997 Unlisted OTC SFDA_GTIN
99999999999998 Unlisted chemotherapy SFDA_GTIN
99999999999999 Unlisted other medications SFDA_GTIN
99999 Unlisted medical devices SFDA_GMDN
9999 Unlisted Out-Patient Dental Code Oral Health Out-patient (ADA)
```

## Section 5.0 JSON Sample Messaging

### 5.1 Package Sample Messaging – IP Appendectomy

##### {

"resourceType": "Bundle",

"id": "5215043c- 1131 - 4e53- 8357 - 3b0120f22002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"

]

},

"type": "message",

"timestamp": "2020- 10 - 19T14:46:51+03:00",

"entry": [

{

"fullUrl": "urn:uuid:672002",

"resource": {

"resourceType": "MessageHeader",

"id": "672002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"

]

},

"eventCoding": {

"system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events",

"code": "priorauth-request"

},

"destination": [


##### {

"endpoint": "http://nphies.sa/license/payer-license/INS-FHIR",

"receiver": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"

}

}

}

],

"sender": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

},

"source": {

"endpoint": "http://nphies.sa/license/provider-license/PR-FHIR"

},

"focus": [

{

"reference": "http://pr-fhir.com.sa/Claim/672002"

}

]

}

},


##### {

"fullUrl": "http://pr-fhir.com.sa/Claim/672002",

"resource": {

"resourceType": "Claim",

"id": "672002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-
priorauth|1.0.0"

]

},

"identifier": [

{

"system": "http://pr-fhir.com.sa/Authorization",

"value": "672002"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/claim-type",

"code": "institutional"

}

]

},

"subType": {

"coding": [


##### {

"system": "http://nphies.sa/terminology/CodeSystem/claim-subtype",

"code": "ip"

}

],

"text": "emr"

},

"use": "preauthorization",

"patient": {

"reference": "Patient/3"

},

"created": "2021- 01 - 20",

"insurer": {

"reference": "Organization/11"

},

"provider": {

"reference": "Organization/10"

},

"priority": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/processpriority",

"code": "deferred"

}

]

},

"payee": {

"type": {


"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/payeetype",

"code": "provider"

}

]

}

},

"careTeam": [

{

"sequence": 1,

"provider": {

"reference": "PractitionerRole/7"

},

"role": {

"coding": [

{

"system":
"http://terminology.hl7.org/CodeSystem/claimcareteamrole",

"code": "primary"

}

]

}

}

],

"diagnosis": [

{

"sequence": 1,


"onAdmission": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-on-
admission",

"code": "y"

}

]

},

"diagnosisCodeableConcept": {

"coding": [

{

"system": "http://hl7.org/fhir/sid/icd- 10 - am",

"code": "A01.1"

}

]

},

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-
type",

"code": "principal"

}

]

}

]

}


##### ],

"insurance": [

{

"sequence": 1,

"focal": true,

"coverage": {

"reference": "Coverage/3"

}

}

],

"item": [

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 100,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
payer-share",

"valueMoney": {

"value": 2500,

"currency": "SAR"

}

},


##### {

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": true

}

],

"sequence": 1,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/procedures",

"code": "30571- 00 - 00"

},

{

"system": "http://pr-fhir.com.sa/package",


"code": "Append332"

}

]

},

"servicedDate": "2020- 08 - 30",

"quantity": {

"value": 1

},

"unitPrice": {

"value": 2400,

"currency": "SAR"

},

"net": {

"value": 2400,

"currency": "SAR"

},

"detail": [

{

"sequence": 1,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/laboratory",

"code": "73250- 00 - 80",

"display": "BLOOD GROUP"

},

{


"system": "http://pr-fhir.com.sa/product-or-service",

"code": 442,

"display": "Lab Blood group"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": 0,

"currency": "SAR"

},

"net": {

"value": 0,

"currency": "SAR"

}

},

{

"sequence": 2,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/services",

"code": "83670- 00 - 60",

"display": "Anesthesia Services Per Unit"

},


##### {

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 889,

"display": "Anesthesia"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": 0,

"currency": "SAR"

},

"net": {

"value": 0,

"currency": "SAR"

}

},

{

"sequence": 3,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/procedures",

"code": "30571- 00 - 00",

"display": "Appendicectomy"


##### },

##### {

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 776,

"display": "Procedure fees"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": 0,

"currency": "SAR"

},

"net": {

"value": 0,

"currency": "SAR"

}

},

{

"sequence": 4,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/imaging",

"code": "58900- 00 - 90",


"display": "XR Abdomen"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 554,

"display": "X-Ray"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": 0,

"currency": "SAR"

},

"net": {

"value": 0,

"currency": "SAR"

}

},

{

"sequence": 5,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/medication-codes",


"code": "06285097000049",

"display": "AUGMENTIN 1.2GM VIAL"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 552,

"display": "Drug"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": 0,

"currency": "SAR"

},

"net": {

"value": 0,

"currency": "SAR"

}

},

{

"sequence": 6,

"productOrService": {

"coding": [

{


"system":
"http://nphies.sa/terminology/CodeSystem/medical-devices",

"code": "47203",

"display": "Wound-nonadherent dressing, permeable,
antimicrobial"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 500,

"display": "Consumables"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": 0,

"currency": "SAR"

},

"net": {

"value": 0,

"currency": "SAR"

}

},

{

"sequence": 7,

"productOrService": {

"coding": [


##### {

"system":
"http://nphies.sa/terminology/CodeSystem/services",

"code": "83610- 01 - 00",

"display": "Room and Board: Per Diem - First Class Room"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": "011",

"display": "Room and Board"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": 0,

"currency": "SAR"

},

"net": {

"value": 0,

"currency": "SAR"

}

}

]

}

],


"total": {

"value": "2400",

"currency": "SAR"

}

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Patient/3",

"resource": {

"resourceType": "Patient",

"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "PRC"

}

]

},

"system": "http://moi.gov.sa/id/iqama",

"value": "00000000003"


##### }

##### ],

"active": true,

"name": [

{

"text": "Muhammad Ali Abbas",

"family": "Abbas",

"given": [

"Muhammad",

"Ali"

]

}

],

"gender": "male",

"_gender": {

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-
administrative-gender",

"valueCodeableConcept": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/ksa-
administrative-gender",

"code": "male"

}

]

}

}


##### ]

##### },

"birthDate": "2010- 08 - 21"

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Coverage/3",

"resource": {

"resourceType": "Coverage",

"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0"

]

},

"identifier": [

{

"system": "http://tmb-ins.com.sa/memberid",

"value": "0000000001-03"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/coverage-type",

"code": "EHCPOL",

"display": "extended healthcare"


##### }

##### ]

##### },

"beneficiary": {

"reference": "Patient/3"

},

"relationship": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/subscriber-relationship",

"code": "child",

"display": "child"

}

]

},

"payor": [

{

"reference": "Organization/11"

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Practitioner/7",

"resource": {

"resourceType": "Practitioner",

"id": "7",

"meta": {


"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "MD"

}

]

},

"system": "http://nphies.sa/license/practitioner-license",

"value": "0007"

}

],

"active": true

}

},

{

"fullUrl": "http://pr-fhir.com.sa/PractitionerRole/7",

"resource": {

"resourceType": "PractitionerRole",

"id": "7",

"meta": {

"profile": [


"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner-role|1.0.0"

]

},

"active": true,

"practitioner": {

"reference": "Practitioner/7"

},

"organization": {

"reference": "Organization/10"

},

"code": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"code": "doctor"

}

]

}

],

"specialty": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practice-codes",

"code": "19.00"

}

]


##### }

##### ],

"identifier": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"value": "ict"

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Organization/10",

"resource": {

"resourceType": "Organization",

"id": "10",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

],


"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "prov"

}

]

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Organization/11",

"resource": {

"resourceType": "Organization",

"id": "11",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/payer-license",


"value": "INS-FHIR"

}

],

"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "ins"

} ] } ] } } ] }


### Salpingotomy 5.2 Package Sample Messaging – In-Patient (IP) Caesarean Section package and

##### {

"resourceType": "Bundle",

"id": "5215043c- 1131 - 4e53- 8357 - 3b0120f22002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"

]

},

"type": "message",

"timestamp": "2020- 10 - 19T14:46:51+03:00",

"entry": [

{

"fullUrl": "urn:uuid:672002",

"resource": {

"resourceType": "MessageHeader",

"id": "672002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"

]

},

"eventCoding": {

"system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events",

"code": "priorauth-request"

},

"destination": [

{


"endpoint": "http://nphies.sa/license/payer-license/INS-FHIR",

"receiver": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"

}

}

}

],

"sender": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

},

"source": {

"endpoint": "http://nphies.sa/license/provider-license/PR-FHIR"

},

"focus": [

{

"reference": "http://pr-fhir.com.sa/Claim/672002"

}

]

}

},

{


"fullUrl": "http://pr-fhir.com.sa/Claim/672002",

"resource": {

"resourceType": "Claim",

"id": "672002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-
priorauth|1.0.0"

]

},

"identifier": [

{

"system": "http://pr-fhir.com.sa/Authorization",

"value": "672002"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/claim-type",

"code": "institutional"

}

]

},

"subType": {

"coding": [

{


"system": "http://nphies.sa/terminology/CodeSystem/claim-subtype",

"code": "ip"

}

],

"text": "emr"

},

"use": "preauthorization",

"patient": {

"reference": "Patient/3"

},

"created": "2021- 01 - 20",

"insurer": {

"reference": "Organization/11"

},

"provider": {

"reference": "Organization/10"

},

"priority": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/processpriority",

"code": "deferred"

}

]

},

"payee": {

"type": {

"coding": [


##### {

"system": "http://terminology.hl7.org/CodeSystem/payeetype",

"code": "provider"

}

]

}

},

"careTeam": [

{

"sequence": 1,

"provider": {

"reference": "PractitionerRole/7"

},

"role": {

"coding": [

{

"system":
"http://terminology.hl7.org/CodeSystem/claimcareteamrole",

"code": "primary"

}

]

}

}

],

"diagnosis": [

{

"sequence": 1,

"onAdmission": {


"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-on-
admission",

"code": "y"

}

]

},

"diagnosisCodeableConcept": {

"coding": [

{

"system": "http://hl7.org/fhir/sid/icd- 10 - am",

"code": "A01.1"

}

]

},

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-
type",

"code": "principal"

}

]

}

]

}

],


"insurance": [

{

"sequence": 1,

"focal": true,

"coverage": {

"reference": "Coverage/3"

}

}

],

"item": [

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 100,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
payer-share",

"valueMoney": {

"value": 2500,

"currency": "SAR"

}

},

{


"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": true

}

],

"sequence": 1,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/procedures",

"code": "16520- 00 - 00"

},

{

"system": "http://pr-fhir.com.sa/package",

"code": "Caesarean001"


##### }

##### ]

##### },

"servicedPeriod": {

"start": "2021- 08 - 20T11:00:00+03:00",

"end": "2021- 08 - 20T11:30:00+03:00"

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "10002",

"currency": "SAR"

},

"net": {

"value": "10002",

"currency": "SAR"

},

"detail": [

{

"sequence": 1,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/laboratory",

"code": "73250- 00 - 80",

"display": "BLOOD GROUP"


##### },

##### {

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 442,

"display": "Lab Blood group"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 2,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/services",

"code": "83670- 00 - 60",


"display": "Anesthesia Services Per Unit"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 889,

"display": "Anesthesia"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 3,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/procedures",


"code": "16520- 00 - 00",

"display": "Appendicectomy"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 776,

"display": "Procedure fees - Elective Caesarean Section
package"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 4,

"productOrService": {

"coding": [

{


"system":
"http://nphies.sa/terminology/CodeSystem/medication-codes",

"code": "06285097000049",

"display": "AUGMENTIN 1.2GM VIAL"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 552,

"display": "Drug"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 5,

"productOrService": {

"coding": [


##### {

"system":
"http://nphies.sa/terminology/CodeSystem/medication-codes",

"code": "06285097000049",

"display": "AUGMENTIN 1.2GM VIAL"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 552,

"display": "Drug"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 6,

"productOrService": {


"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/medical-devices",

"code": 47203,

"display": "Wound-nonadherent dressing, permeable,
antimicrobial"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 500,

"display": "Consumables"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

}

]

},


##### {

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 100,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
payer-share",

"valueMoney": {

"value": 2500,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false


##### }

##### ],

"sequence": 2,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/procedures",

"code": "35713- 12 - 00"

},

{

"system": "http://pr-fhir.com.sa/package",

"code": "770"

}

]

},

"servicedPeriod": {

"start": "2021- 08 - 20T11:00:00+03:00",

"end": "2021- 08 - 20T11:30:00+03:00"

},

"quantity": {

"value": 1

},


"unitPrice": {

"value": "1000",

"currency": "SAR"

},

"net": {

"value": "1000",

"currency": "SAR"

}

}

],

"total": {

"value": "11002",

"currency": "SAR"

}

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Patient/3",

"resource": {

"resourceType": "Patient",

"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0"

]

},

"identifier": [

{


"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "PRC"

}

]

},

"system": "http://moi.gov.sa/id/iqama",

"value": "00000000003"

}

],

"active": true,

"name": [

{

"text": "Muhammad Ali Abbas",

"family": "Abbas",

"given": [

"Muhammad",

"Ali"

]

}

],

"gender": "male",

"_gender": {

"extension": [

{


"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-
administrative-gender",

"valueCodeableConcept": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/ksa-
administrative-gender",

"code": "male"

}

]

}

}

]

},

"birthDate": "2010- 08 - 21"

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Coverage/3",

"resource": {

"resourceType": "Coverage",

"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0"

]

},

"identifier": [

{


"system": "http://tmb-ins.com.sa/memberid",

"value": "0000000001-03"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/coverage-type",

"code": "EHCPOL",

"display": "extended healthcare"

}

]

},

"beneficiary": {

"reference": "Patient/3"

},

"relationship": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/subscriber-relationship",

"code": "child",

"display": "child"

}

]

},

"payor": [

{


"reference": "Organization/11"

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Practitioner/7",

"resource": {

"resourceType": "Practitioner",

"id": "7",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "MD"

}

]

},

"system": "http://nphies.sa/license/practitioner-license",

"value": "0007"

}


##### ],

"active": true

}

},

{

"fullUrl": "http://pr-fhir.com.sa/PractitionerRole/7",

"resource": {

"resourceType": "PractitionerRole",

"id": "7",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner-role|1.0.0"

]

},

"active": true,

"practitioner": {

"reference": "Practitioner/7"

},

"organization": {

"reference": "Organization/10"

},

"code": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"code": "doctor"

}


##### ]

##### }

##### ],

"specialty": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practice-codes",

"code": "19.00"

}

]

}

],

"identifier": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"value": "ict"

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Organization/10",

"resource": {

"resourceType": "Organization",

"id": "10",

"meta": {

"profile": [


"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

],

"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "prov"

}

]

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Organization/11",

"resource": {

"resourceType": "Organization",


"id": "11",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"

}

],

"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "ins"

} ] } ] } } ]


##### }

### Electroencephalography 5.3 Package Sample Messaging – IP In-Patient (IP) Partial lobectomy of brain package and

```
Electroencephalography
```
##### {

"resourceType": "Bundle",

"id": "847d7cbe-9d98-4c3b-a02c-25a92c501090",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"

]

},

"type": "message",

"timestamp": "2020- 10 - 19T14:46:51+03:00",

"entry": [

{

"fullUrl": "urn:uuid:62ab320a-fe38-451d-a13b-c433a0741090",

"resource": {

"resourceType": "MessageHeader",

"id": "62ab320a-fe38-451d-a13b-c433a0741090",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"

]

},

"eventCoding": {

"system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events",


"code": "priorauth-request"

},

"destination": [

{

"endpoint": "http://nphies.sa/license/payer-license/INS-FHIR",

"receiver": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"

}

}

}

],

"sender": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

},

"source": {

"endpoint": "http://nphies.sa/license/provider-license/PR-FHIR"

},

"focus": [

{

"reference": "http://pr-fhir.com.sa/Claim/991090"

}


##### ]

##### }

##### },

##### {

"fullUrl": "http://pr-fhir.com.sa/Claim/991090",

"resource": {

"resourceType": "Claim",

"id": "991090",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-
priorauth|1.0.0"

]

},

"identifier": [

{

"system": "http://pr-fhir.com.sa/Authorization",

"value": "991090"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/claim-type",

"code": "institutional"

}

]


##### },

"subType": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/claim-subtype",

"code": "ip"

}

],

"text": "emr"

},

"use": "preauthorization",

"patient": {

"reference": "Patient/3"

},

"created": "2021- 02 - 17",

"insurer": {

"reference": "Organization/11"

},

"provider": {

"reference": "Organization/10"

},

"priority": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/processpriority",

"code": "deferred"

}

]


##### },

"payee": {

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/payeetype",

"code": "provider"

}

]

}

},

"careTeam": [

{

"sequence": 1,

"provider": {

"reference": "PractitionerRole/7"

},

"role": {

"coding": [

{

"system":
"http://terminology.hl7.org/CodeSystem/claimcareteamrole",

"code": "primary"

}

]

}

}

],


"diagnosis": [

{

"sequence": 1,

"diagnosisCodeableConcept": {

"coding": [

{

"system": "http://hl7.org/fhir/sid/icd- 10 - am",

"code": "A01.1"

}

]

},

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-
type",

"code": "principal"

}

]

}

],

"onAdmission": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-on-
admission",

"code": "y"

}


##### ]

##### }

##### }

##### ],

"insurance": [

{

"sequence": 1,

"focal": true,

"coverage": {

"reference": "Coverage/3"

}

}

],

"item": [

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 100,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
payer-share",

"valueMoney": {

"value": 2500,


"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": true

}

],

"sequence": 1,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/procedures",

"code": "40703- 02 - 00"


##### },

##### {

"system": "http://pr-fhir.com.sa/package",

"code": "Brain001"

}

]

},

"servicedPeriod": {

"start": "2021- 08 - 20T11:00:00+03:00",

"end": "2021- 08 - 20T11:30:00+03:00"

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "21000",

"currency": "SAR"

},

"net": {

"value": "21000",

"currency": "SAR"

},

"detail": [

{

"sequence": 1,

"productOrService": {

"coding": [

{


"system":
"http://nphies.sa/terminology/CodeSystem/laboratory",

"code": "73250- 00 - 80",

"display": "BLOOD GROUP"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 442,

"display": "Lab Blood group"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 2,

"productOrService": {

"coding": [


##### {

"system":
"http://nphies.sa/terminology/CodeSystem/services",

"code": "83670- 00 - 60",

"display": "Anesthesia Services Per Unit"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 889,

"display": "Anesthesia"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 3,

"productOrService": {


"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/procedures",

"code": "40703- 02 - 00",

"display": "Elective Partial lobectomy of brain"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 650,

"display": "Procedure fees - Partial lobectomy of brain
package"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 4,


"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/imaging",

"code": "56 007 - 00 - 00",

"display": "Computerised tomography of brain"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": "330",

"display": "Tomography of brain"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{


"sequence": 5,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/medication-codes",

"code": "06285097000049",

"display": "AUGMENTIN 1.2GM VIAL"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 552,

"display": "Drug"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},


##### {

"sequence": 6,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/medical-devices",

"code": "47203",

"display": "Wound-nonadherent dressing, permeable,
antimicrobial"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": "500",

"display": "Consumables"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}


##### },

##### {

"sequence": 7,

"productOrService": {

"coding": [

{

"system":
"http://nphies.sa/terminology/CodeSystem/services",

"code": "83610- 01 - 00",

"display": "Room and Board: Per Diem - First Class Room"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": "83610- 01 - 00",

"display": "Room and Board"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"


##### }

##### }

##### ]

##### },

##### {

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 100,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
payer-share",

"valueMoney": {

"value": 2500,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"

}


##### },

##### {

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false

}

],

"sequence": 2,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/procedures",

"code": "11000- 00 - 00"

},

{

"system": "http://pr-fhir.com.sa/package",

"code": "335"

}

]

},

"servicedPeriod": {

"start": "2021- 08 - 20T11:00:00+03:00",


"end": "2021- 08 - 20T11:30:00+03:00"

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "1000",

"currency": "SAR"

},

"net": {

"value": "1000",

"currency": "SAR"

}

}

],

"total": {

"value": "22000",

"currency": "SAR"

}

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Patient/3",

"resource": {

"resourceType": "Patient",

"id": "3",

"meta": {

"profile": [


"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "PRC"

}

]

},

"system": "http://moi.gov.sa/id/iqama",

"value": "00000000003"

}

],

"active": true,

"name": [

{

"text": "Muhammad Ali Abbas",

"family": "Abbas",

"given": [

"Muhammad",

"Ali"

]

}

],


"gender": "male",

"_gender": {

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-
administrative-gender",

"valueCodeableConcept": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/ksa-
administrative-gender",

"code": "male"

}

]

}

}

]

},

"birthDate": "2010- 08 - 21"

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Coverage/3",

"resource": {

"resourceType": "Coverage",

"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0"


##### ]

##### },

"identifier": [

{

"system": "http://tmb-ins.com.sa/memberid",

"value": "0000000001-03"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/coverage-type",

"code": "EHCPOL",

"display": "extended healthcare"

}

]

},

"beneficiary": {

"reference": "Patient/3"

},

"relationship": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/subscriber-relationship",

"code": "child",

"display": "child"

}


##### ]

##### },

"payor": [

{

"reference": "Organization/11"

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Practitioner/7",

"resource": {

"resourceType": "Practitioner",

"id": "7",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "MD"

}

]


##### },

"system": "http://nphies.sa/license/practitioner-license",

"value": "0007"

}

],

"active": true

}

},

{

"fullUrl": "http://pr-fhir.com.sa/PractitionerRole/7",

"resource": {

"resourceType": "PractitionerRole",

"id": "7",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner-role|1.0.0"

]

},

"identifier": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"value": "ict"

}

],

"active": true,

"practitioner": {

"reference": "Practitioner/7"

},


"organization": {

"reference": "Organization/10"

},

"code": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"code": "doctor"

}

]

}

],

"specialty": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practice-codes",

"code": "19.00"

}

]

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Organization/10",

"resource": {


"resourceType": "Organization",

"id": "10",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

],

"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "prov"

}

]

}

]

}

},


##### {

"fullUrl": "http://pr-fhir.com.sa/Organization/11",

"resource": {

"resourceType": "Organization",

"id": "11",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"

}

],

"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "ins"

}

]

}


##### ]

##### }

##### }

##### ]

##### }

### Filling 5.4 Package Sample Messaging – Out-Patient (OP) Root Canal Treatment (3 Roots) with

##### {

"resourceType": "Bundle",

"id": "847d7cbe-9d98-4c3b-a02c-25a92c502990",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"

]

},

"type": "message",

"timestamp": "2020- 10 - 19T14:46:51+03:00",

"entry": [

{

"fullUrl": "urn:uuid:62ab320a-fe38-451d-a13b-c433a0742990",

"resource": {

"resourceType": "MessageHeader",

"id": "62ab320a-fe38-451d-a13b-c433a0742990",

"meta": {

"profile": [


"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"

]

},

"eventCoding": {

"system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events",

"code": "priorauth-request"

},

"destination": [

{

"endpoint": "http://nphies.sa/license/payer-license/INS-FHIR",

"receiver": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"

}

}

}

],

"sender": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

},

"source": {

"endpoint": "http://nphies.sa/license/provider-license/PR-FHIR"


##### },

"focus": [

{

"reference": "http://pr-fhir.com.sa/Claim/992990"

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Claim/992990",

"resource": {

"resourceType": "Claim",

"id": "992990",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-
priorauth|1.0.0"

]

},

"identifier": [

{

"system": "http://pr-fhir.com.sa/Authorization",

"value": "992990"

}

],

"status": "active",

"type": {

"coding": [


##### {

"system": "http://terminology.hl7.org/CodeSystem/claim-type",

"code": "institutional"

}

]

},

"subType": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/claim-subtype",

"code": "ip"

}

],

"text": "emr"

},

"use": "preauthorization",

"patient": {

"reference": "Patient/3"

},

"created": "2021- 02 - 17",

"insurer": {

"reference": "Organization/11"

},

"provider": {

"reference": "Organization/10"

},

"priority": {

"coding": [


##### {

"system": "http://terminology.hl7.org/CodeSystem/processpriority",

"code": "deferred"

}

]

},

"payee": {

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/payeetype",

"code": "provider"

}

]

}

},

"careTeam": [

{

"sequence": 1,

"provider": {

"reference": "PractitionerRole/7"

},

"role": {

"coding": [

{

"system":
"http://terminology.hl7.org/CodeSystem/claimcareteamrole",

"code": "primary"


##### }

##### ]

##### }

##### }

##### ],

"diagnosis": [

{

"sequence": 1,

"diagnosisCodeableConcept": {

"coding": [

{

"system": "http://hl7.org/fhir/sid/icd- 10 - am",

"code": "A01.1"

}

]

},

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-
type",

"code": "principal"

}

]

}

],

"onAdmission": {


"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-on-
admission",

"code": "y"

}

]

}

}

],

"insurance": [

{

"sequence": 1,

"focal": true,

"coverage": {

"reference": "Coverage/3"

}

}

],

"item": [

{

"sequence": 1,

"careTeamSequence": [

1

],

"category": {

"text": "5"

},


"extension":[

{

"url":"http://nphies.sa/fhir/ksa/nphies-
fs/StructureDefinition/extension-tax",

"valueMoney":{

"value":10,

"currency":"SAR"

}

},

{

"url":"http://nphies.sa/fhir/ksa/nphies-
fs/StructureDefinition/extension-patient-share",

"valueMoney":{

"value":0,

"currency":"SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-
fs/StructureDefinition/extension-package",

"valueBoolean": true

}

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/oral-health-op",

"code": "415"

},


##### {

"system": "http://pr-fhir.com.sa/package",

"code": "Den001"

}

]

},

"servicedDate": "2029- 10 - 05",

"quantity": {

"value": 1

},

"unitPrice": {

"value": "2000",

"currency": "SAR"

},

"net": {

"value": "2000",

"currency": "SAR"

},

"detail": [

{

"sequence": 1,

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/oral-
health-op",

"code": "415",

"display": "Complete chemo-mechanical preparation,
including removal of pulp or necrotic debris from a canal"


##### },

##### {

"system": "http://pr-fhir.com.sa/product-or-service",

"code": "001",

"display": "Root Canal Treatment 1 Canal"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 2,

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/oral-
health-op",

"code": "416",


"display": "Complete chemo-mechanical preparation,
including removal of pulp or necrotic debris from each additional canal of a tooth with multiple canals"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": "002",

"display": "Root Canal Treatment Additional Canal"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 3,

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/oral-
health-op",


"code": "416",

"display": "Complete chemo-mechanical preparation,
including removal of pulp or necrotic debris from each additional canal of a tooth with multiple canals"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": "002",

"display": "Root Canal Treatment Additional Canal"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

},

{

"sequence": 4,

"productOrService": {

"coding": [

{


"system": "http://nphies.sa/terminology/CodeSystem/oral-
health-op",

"code": "533",

"display": "Direct restoration, using an adhesive technique
and a tooth-coloured material, involving three surfaces of a posterior tooth"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": "001",

"display": "Root Canal Treatment 1 Canal"

}

]

},

"quantity": {

"value": 1

},

"unitPrice": {

"value": "0",

"currency": "SAR"

},

"net": {

"value": "0",

"currency": "SAR"

}

}

]

}

],

"total": {


"value": "2000",

"currency": "SAR"

}

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Patient/3",

"resource": {

"resourceType": "Patient",

"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "PRC"

}

]

},

"system": "http://moi.gov.sa/id/iqama",

"value": "00000000003"

}


##### ],

"active": true,

"name": [

{

"text": "Muhammad Ali Abbas",

"family": "Abbas",

"given": [

"Muhammad",

"Ali"

]

}

],

"gender": "male",

"_gender": {

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-
administrative-gender",

"valueCodeableConcept": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/ksa-
administrative-gender",

"code": "male"

}

]

}

}

]


##### },

"birthDate": "2010- 08 - 21"

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Coverage/3",

"resource": {

"resourceType": "Coverage",

"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0"

]

},

"identifier": [

{

"system": "http://tmb-ins.com.sa/memberid",

"value": "0000000001-03"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/coverage-type",

"code": "EHCPOL",

"display": "extended healthcare"

}


##### ]

##### },

"beneficiary": {

"reference": "Patient/3"

},

"relationship": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/subscriber-relationship",

"code": "child",

"display": "child"

}

]

},

"payor": [

{

"reference": "Organization/11"

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Practitioner/7",

"resource": {

"resourceType": "Practitioner",

"id": "7",

"meta": {

"profile": [


"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "MD"

}

]

},

"system": "http://nphies.sa/license/practitioner-license",

"value": "0007"

}

],

"active": true

}

},

{

"fullUrl": "http://pr-fhir.com.sa/PractitionerRole/7",

"resource": {

"resourceType": "PractitionerRole",

"id": "7",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner-role|1.0.0"


##### ]

##### },

"identifier": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"value": "ict"

}

],

"active": true,

"practitioner": {

"reference": "Practitioner/7"

},

"organization": {

"reference": "Organization/10"

},

"code": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"code": "doctor"

}

]

}

],

"specialty": [

{

"coding": [


##### {

"system": "http://nphies.sa/terminology/CodeSystem/practice-codes",

"code": "19.00"

}

]

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Organization/10",

"resource": {

"resourceType": "Organization",

"id": "10",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

],

"active": true,


"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "prov"

}

]

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Organization/11",

"resource": {

"resourceType": "Organization",

"id": "11",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"


##### }

##### ],

"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "ins"

} ] } ] } } ] }


### 5.5 Non-Standard Code Fee-For-Service Sample Messaging

##### {

"resourceType": "Bundle",

"id": "5215043c- 1131 - 4e53- 8357 - 3b0120f22002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"

]

},

"type": "message",

"timestamp": "2020- 10 - 19T14:46:51+03:00",

"entry": [

{

"fullUrl": "urn:uuid:672002",

"resource": {

"resourceType": "MessageHeader",

"id": "672002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"

]

},

"eventCoding": {

"system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events",

"code": "priorauth-request"

},

"destination": [


##### {

"endpoint": "http://nphies.sa/license/payer-license/INS-FHIR",

"receiver": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"

}

}

}

],

"sender": {

"type": "Organization",

"identifier": {

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

},

"source": {

"endpoint": "http://nphies.sa/license/provider-license/PR-FHIR"

},

"focus": [

{

"reference": "http://pr-fhir.com.sa/Claim/672002"

}

]

}

},


##### {

"fullUrl": "http://pr-fhir.com.sa/Claim/672002",

"resource": {

"resourceType": "Claim",

"id": "672002",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-
priorauth|1.0.0"

]

},

"identifier": [

{

"system": "http://pr-fhir.com.sa/Authorization",

"value": "672002"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/claim-type",

"code": "institutional"

}

]

},

"subType": {

"coding": [


##### {

"system": "http://nphies.sa/terminology/CodeSystem/claim-subtype",

"code": "ip"

}

],

"text": "emr"

},

"use": "preauthorization",

"patient": {

"reference": "Patient/3"

},

"created": "2021- 01 - 20",

"insurer": {

"reference": "Organization/11"

},

"provider": {

"reference": "Organization/10"

},

"priority": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/processpriority",

"code": "deferred"

}

]

},

"payee": {

"type": {


"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/payeetype",

"code": "provider"

}

]

}

},

"careTeam": [

{

"sequence": 1,

"provider": {

"reference": "PractitionerRole/7"

},

"role": {

"coding": [

{

"system":
"http://terminology.hl7.org/CodeSystem/claimcareteamrole",

"code": "primary"

}

]

}

}

],

"diagnosis": [

{

"sequence": 1,


"onAdmission": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-on-
admission",

"code": "y"

}

]

},

"diagnosisCodeableConcept": {

"coding": [

{

"system": "http://hl7.org/fhir/sid/icd- 10 - am",

"code": "A01.1"

}

]

},

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/diagnosis-
type",

"code": "principal"

}

]

}

]

}


##### ],

"insurance": [

{

"sequence": 1,

"focal": true,

"coverage": {

"reference": "Coverage/3"

}

}

],

"item": [

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 10,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"

}

},


##### {

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false

}

],

"sequence": 1,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/laboratory",

"code": "73250- 00 - 80",

"display": "BLOOD GROUP"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 442,

"display": "Lab Blood group"

}

]

},

"servicedDate": "2021- 12 - 03",


"quantity": {

"value": 1

},

"unitPrice": {

"value": 200,

"currency": "SAR"

},

"net": {

"value": 200,

"currency": "SAR"

}

},

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 20,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"

}


##### },

##### {

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false

}

],

"sequence": 2,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/services",

"code": "83670- 00 - 60",

"display": "Anesthesia Services Per Unit"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 889,

"display": "Anesthesia"

}

]

},


"servicedDate": "2021- 08 - 30",

"quantity": {

"value": 1

},

"unitPrice": {

"value": 400,

"currency": "SAR"

},

"net": {

"value": 400,

"currency": "SAR"

}

},

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 60,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"


##### }

##### },

##### {

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false

}

],

"sequence": 3,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/procedures",

"code": "30571- 00 - 00",

"display": "Appendicectomy"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 776,

"display": "Procedure fees"

}

]


##### },

"servicedDate": "2021- 08 - 30",

"quantity": {

"value": 1

},

"unitPrice": {

"value": 1200,

"currency": "SAR"

},

"net": {

"value": 1200,

"currency": "SAR"

}

},

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 10,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,


"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false

}

],

"sequence": 4,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/imaging",

"code": "58900- 00 - 90",

"display": "XR Abdomen"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 554,

"display": "X-Ray"

}


##### ]

##### },

"servicedDate": "2021- 08 - 30",

"quantity": {

"value": 1

},

"unitPrice": {

"value": 200,

"currency": "SAR"

},

"net": {

"value": 200,

"currency": "SAR"

}

},

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 5,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {


"value": 0,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false

}

],

"sequence": 5,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/medication-
codes",

"code": "06285097000049",

"display": "AUGMENTIN 1.2GM VIAL"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 552,

"display": "Drug"


##### }

##### ]

##### },

"servicedDate": "2021- 08 - 30",

"quantity": {

"value": 1

},

"unitPrice": {

"value": 100,

"currency": "SAR"

},

"net": {

"value": 100,

"currency": "SAR"

}

},

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 5,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",


"valueMoney": {

"value": 0,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false

}

],

"sequence": 6,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/medical-
devices",

"code": 47203,

"display": "Wound-nonadherent dressing, permeable, antimicrobial"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",

"code": 500,


"display": "Consumables"

}

]

},

"servicedDate": "2021- 08 - 30",

"quantity": {

"value": 1

},

"unitPrice": {

"value": 100,

"currency": "SAR"

},

"net": {

"value": 100,

"currency": "SAR"

}

},

{

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
tax",

"valueMoney": {

"value": 50,

"currency": "SAR"

}

},

{


"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
patient-share",

"valueMoney": {

"value": 0,

"currency": "SAR"

}

},

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-
package",

"valueBoolean": false

}

],

"sequence": 7,

"careTeamSequence": [

1

],

"diagnosisSequence": [

1

],

"productOrService": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/services",

"code": "83610- 01 - 00",

"display": "Room and Board: Per Diem - First Class Room"

},

{

"system": "http://pr-fhir.com.sa/product-or-service",


"code": "011",

"display": "Room and Board"

}

]

},

"servicedDate": "2021- 08 - 30",

"quantity": {

"value": 1

},

"unitPrice": {

"value": 1000,

"currency": "SAR"

},

"net": {

"value": 1000,

"currency": "SAR"

}

}

],

"total": {

"value": "3200",

"currency": "SAR"

}

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Patient/3",

"resource": {


"resourceType": "Patient",

"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{

"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "PRC"

}

]

},

"system": "http://moi.gov.sa/id/iqama",

"value": "00000000003"

}

],

"active": true,

"name": [

{

"text": "Muhammad Ali Abbas",

"family": "Abbas",

"given": [

"Muhammad",


"Ali"

]

}

],

"gender": "male",

"_gender": {

"extension": [

{

"url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-
administrative-gender",

"valueCodeableConcept": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/ksa-
administrative-gender",

"code": "male"

}

]

}

}

]

},

"birthDate": "2010- 08 - 21"

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Coverage/3",

"resource": {

"resourceType": "Coverage",


"id": "3",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0"

]

},

"identifier": [

{

"system": "http://tmb-ins.com.sa/memberid",

"value": "0000000001-03"

}

],

"status": "active",

"type": {

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/coverage-type",

"code": "EHCPOL",

"display": "extended healthcare"

}

]

},

"beneficiary": {

"reference": "Patient/3"

},

"relationship": {

"coding": [

{


"system": "http://terminology.hl7.org/CodeSystem/subscriber-relationship",

"code": "child",

"display": "child"

}

]

},

"payor": [

{

"reference": "Organization/11"

}

]

}

},

{

"fullUrl": "http://pr-fhir.com.sa/Practitioner/7",

"resource": {

"resourceType": "Practitioner",

"id": "7",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0"

]

},

"identifier": [

{

"type": {

"coding": [

{


"system": "http://terminology.hl7.org/CodeSystem/v2-0203",

"code": "MD"

}

]

},

"system": "http://nphies.sa/license/practitioner-license",

"value": "0007"

}

],

"active": true

}

},

{

"fullUrl": "http://pr-fhir.com.sa/PractitionerRole/7",

"resource": {

"resourceType": "PractitionerRole",

"id": "7",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner-role|1.0.0"

]

},

"active": true,

"practitioner": {

"reference": "Practitioner/7"

},

"organization": {

"reference": "Organization/10"


##### },

"code": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"code": "doctor"

}

]

}

],

"specialty": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practice-codes",

"code": "19.00"

}

]

}

],

"identifier": [

{

"system": "http://nphies.sa/terminology/CodeSystem/practitioner-role",

"value": "ict"

}

]

}


##### },

##### {

"fullUrl": "http://pr-fhir.com.sa/Organization/10",

"resource": {

"resourceType": "Organization",

"id": "10",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/provider-license",

"value": "PR-FHIR"

}

],

"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",

"code": "prov"

}

]


##### }

##### ]

##### }

##### },

##### {

"fullUrl": "http://pr-fhir.com.sa/Organization/11",

"resource": {

"resourceType": "Organization",

"id": "11",

"meta": {

"profile": [

"http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-
organization|1.0.0"

]

},

"identifier": [

{

"use": "official",

"system": "http://nphies.sa/license/payer-license",

"value": "INS-FHIR"

}

],

"active": true,

"type": [

{

"coding": [

{

"system": "http://nphies.sa/terminology/CodeSystem/organization-type",


"code": "ins"

} ] } ] } } ] }


