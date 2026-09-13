# NPHIES wire contract fixtures

`nphies-bundles.json` contains 14 synthetic bundles captured from the pre-fix backend at commit `7863b600e4d1c0c81bf0a784e1ad89697778a637`.

`renderBundles.js` freezes time, UUID generation, random values, and environment identifiers to compare complete JSON output reproducibly. Capturing fixtures executes mappers locally; it does not send requests to NPHIES. The historical sandbox URL in the polling fixture is wire data only.

Do not regenerate the reference from changed code merely to make tests pass. Review intentional contract changes against the original output and the applicable integration requirements first.
