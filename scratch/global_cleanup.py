import re
import os

def clean_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if '<<<<<<< HEAD' not in content:
            return False
            
        print(f"Cleaning {file_path}")
        # Pattern to match merge conflicts and keep HEAD (the first part)
        pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======.*?>>>>>>> [^\n]*', re.DOTALL)
        new_content = pattern.sub(r'\1', content)
        
        # Second pass for malformed ones (e.g. missing <<<<<<< HEAD but having =======)
        # This is dangerous but we need to fix it.
        # Actually let's just stick to standard markers for now.
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    except Exception as e:
        print(f"Error cleaning {file_path}: {e}")
        return False

root_dir = r'e:\Mauze Tahfeez'
for root, dirs, files in os.walk(root_dir):
    if 'node_modules' in dirs:
        dirs.remove('node_modules')
    if '.git' in dirs:
        dirs.remove('.git')
    if 'dist' in dirs:
        dirs.remove('dist')
        
    for file in files:
        if file.endswith(('.jsx', '.js', '.css', '.html', '.json')):
            full_path = os.path.join(root, file)
            clean_file(full_path)

print("Global cleanup complete.")
