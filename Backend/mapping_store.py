mapping_store = {}

def store_mapping(fake, real):
    mapping_store[fake] = real

def load_mapping():
    return mapping_store

def restore_text(text):
    for fake, real in mapping_store.items():
        text = text.replace(fake, real)
    return text