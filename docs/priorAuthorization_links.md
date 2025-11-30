https://portal.nphies.sa/ig/usecase-prior-authorizations.html
<pre><a href="StructureDefinition-bundle.html">Nphies Bundle</a> (.type = message )
  <a href="StructureDefinition-message-header.html">Nphies MessageHeader</a> (.eventCoding = priorauth-request)
  One of the following Authorization profiles:
     <a href="StructureDefinition-institutional-priorauth.html">Nphies Authorization Institutional</a>
     <a href="StructureDefinition-oral-priorauth.html">Nphies Authorization Oral</a>
     <a href="StructureDefinition-pharmacy-priorauth.html">Nphies Authorization Pharmacy</a>
     <a href="StructureDefinition-professional-priorauth.html">Nphies Authorization Professional</a>
     <a href="StructureDefinition-vision-priorauth.html">Nphies Authorization Vision</a>
  <a href="StructureDefinition-coverage.html">Nphies Coverage</a>
  <a href="StructureDefinition-patient.html">Nphies Patient</a>
  <a href="StructureDefinition-provider-organization.html">Nphies Organization (Provider)</a>
  <a href="StructureDefinition-insurer-organization.html">Nphies Organization (Insurer)</a>
  <a href="StructureDefinition-practitioner.html">Nphies Practitioner</a>
  One of the following Encounter profiles based on the Authorization profile selected above: 
     <a href="StructureDefinition-encounter-auth-AMB.html">Nphies Encounter Auth AMB (Ambulatory)</a>
     <a href="StructureDefinition-encounter-auth-EMER.html">Nphies Encounter Auth EMER (Emergency)</a>
     <a href="StructureDefinition-encounter-auth-HH.html">Nphies Encounter Auth HH (Home Healthcare)</a>
     <a href="StructureDefinition-encounter-auth-IMP.html">Nphies Encounter Auth IMP (In-Patient)</a>
     <a href="StructureDefinition-encounter-auth-SS.html">Nphies Encounter Auth SS (Day Case)</a>
     <a href="StructureDefinition-encounter-auth-VR.html">Nphies Encounter Auth VR (Telemedicine)</a>
  [any additional resources]
</pre>