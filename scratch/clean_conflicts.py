import re
import os

file_path = r'e:\Mauze Tahfeez\src\App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match merge conflicts and keep HEAD (the first part)
# This is a bit risky but given the volume of markers, it's the fastest way to get a buildable file.
# We keep the content between <<<<<<< HEAD and =======
pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======.*?>>>>>>> [a-f0-9]+', re.DOTALL)
new_content = pattern.sub(r'\1', content)

# Also handle cases where there might not be a hash in the end marker
pattern2 = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======.*?>>>>>>> [^\n]*', re.DOTALL)
new_content = pattern2.sub(r'\1', new_content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Cleaned App.jsx")
