import os

def compile_full_codebase():
    base_dir = r"c:\Users\ACER\mystartup"
    output_file = r"c:\Users\ACER\mystartup\shareverse_full_codebase_compiled.txt"
    
    # Extensions to include
    include_exts = {
        ".js", ".jsx", ".ts", ".tsx",
        ".py", ".css", ".html",
        ".json", ".md", ".yaml", ".yml",
        ".dart", ".java", ".kt", ".swift", ".xcworkspace", ".pbxproj"
    }
    
    # Substrings in paths to strictly exclude
    exclude_substrings = [
        "node_modules",
        ".git",
        "__pycache__",
        "__mocks__",
        ".test.",
        ".env",
        ".next",
        "build",
        "dist",
        "coverage",
        "shareverse_full_codebase",
        "shareverse_desktop_ui_codebase"
    ]
    
    all_files = []
    
    for root, dirs, files in os.walk(base_dir):
        # Optional optimization: modify dirs in-place to avoid traversing excluded dirs
        dirs[:] = [d for d in dirs if not any(excl in os.path.join(root, d) for excl in exclude_substrings)]
        
        for file in files:
            filepath = os.path.join(root, file)
            norm_path = os.path.normpath(filepath)
            
            # Check exclusions
            if any(excl in norm_path for excl in exclude_substrings):
                continue
            
            # Check extensions
            ext = os.path.splitext(file)[1].lower()
            if ext in include_exts or file in ["Dockerfile", "Makefile"]:
                all_files.append(norm_path)
    
    # Compile
    with open(output_file, "w", encoding="utf-8") as outfile:
        outfile.write("# Shareverse Full Codebase\n\n")
        
        for filepath in all_files:
            try:
                # Some files might not be text despite extension or might have encoding issues
                with open(filepath, "r", encoding="utf-8") as infile:
                    content = infile.read()
                
                rel_path = os.path.relpath(filepath, base_dir)
                
                outfile.write(f"--- File: {rel_path} ---\n")
                outfile.write(content)
                outfile.write("\n\n")
            except Exception as e:
                # If a file cannot be read as utf-8, skip it or log error
                outfile.write(f"--- Error reading file: {os.path.relpath(filepath, base_dir)} ({e}) ---\n\n")
                
    print(f"Successfully compiled {len(all_files)} files into {output_file}")

if __name__ == '__main__':
    compile_full_codebase()
