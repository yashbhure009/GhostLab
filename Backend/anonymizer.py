from presidio_analyzer import AnalyzerEngine
from faker import Faker
from Backend.mapping_store import store_mapping, load_mapping
analyzer = AnalyzerEngine()
fake = Faker()
def anonymize_text(text, known_fakes=None):
    if known_fakes is None:
        known_fakes = set()
    mapping = load_mapping()
    results = analyzer.analyze(
        text=text,
        entities=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER"],
        language="en"
    )
    results = sorted(results, key=lambda x: x.start)
    sanitized = text
    offset = 0
    for result in results:
        pii_value = text[result.start:result.end]
        if pii_value in known_fakes:
            continue
        if pii_value in mapping:
            continue

        # Skip very short or whitespace-only matches
        if len(pii_value.strip()) < 3:
            continue

        # Check if we already have a fake for this real value (consistency)
        existing_fake = None
        for fake_val, real_val in mapping.items():
            if real_val == pii_value:
                existing_fake = fake_val
                break

        if existing_fake:
            fake_value = existing_fake
        else:
            if result.entity_type == "PERSON":
                fake_value = fake.name()
            elif result.entity_type == "EMAIL_ADDRESS":
                fake_value = fake.email()
            elif result.entity_type == "PHONE_NUMBER":
                fake_value = str(fake.random_number(digits=10, fix_len=True))
            else:
                continue

            store_mapping(fake_value, pii_value)
            mapping[fake_value] = pii_value

        adj_start = result.start + offset
        adj_end = result.end + offset

        sanitized = sanitized[:adj_start] + fake_value + sanitized[adj_end:]

        # Update offset for next iteration
        offset += len(fake_value) - (result.end - result.start)

    return sanitized