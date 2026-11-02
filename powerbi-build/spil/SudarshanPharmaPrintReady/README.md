# Sudarshan Pharma - PDF-ready credit review

Share **SudarshanPharma_Full_Review.pdf**. It contains complete analysis and explicitly labelled transaction previews. No scrolling is required to read the PDF. Continuation pages preserve all non-transaction review records and all three audited financial years.

Bank transactions, party receipt/payment detail and return/penal evidence are limited to 15 preview rows each in this PDF. All 25,180 bank transactions remain in ExtractedData and the original interactive Power BI report. The original dashboard and its year filters are unchanged.

The native Power BI Print projects reproduce the printable snapshot using fixed text pages. Open the numbered .pbip files with their adjacent folders intact. Each pack has no more than 50 pages, the standard Power BI PDF export limit. Export every page in each pack in filename order if recreating the complete PDF. Printed pages carry continuous global page numbers. These are fixed source snapshots; refreshing does not re-extract changed source PDFs or recalculate printed text. Re-run build_print_report.py after rebuilding source data to update the printable report. The interactive dashboard remains the report for filtering and scrolling.

All GST records, all 16 reconciliation months, all 75 annual financial parameters, complete annual financial records, all 32 loan facilities, all five CC snapshots, account/month summaries, coverage checks, original explanatory notes and source qualifications are printed. SourceInventory.json and the original extraction artifacts retain provenance. Missing values are labelled unavailable; blank source fields are labelled explicitly. Financial details use INR; summary amounts explicitly labelled crore are converted to crore. FY2024 previous GAAP and FY2025 restated Ind AS are retained with the comparability notes.

PrintManifest.json lists pages and pack boundaries. PrintValidation.json records automatic PDF coverage, layout and native schema checks. The original interactive deliverable is ../SudarshanPharmaCreditReview/SudarshanPharmaCreditReview.pbip.
