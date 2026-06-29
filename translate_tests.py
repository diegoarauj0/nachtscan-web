import re
from pathlib import Path

BASE = Path("/home/diegoaraujo/Repo/nachtscan-web/server/src/modules/scan")

MAPPING = {
    ###########################
    # scan.controller.spec.ts
    ###########################
    "should call scanService.scanNickname with the nickname": (
        "deve chamar scanService.scanNickname com o nickname | "
        "should call scanService.scanNickname with the nickname"
    ),
    "should not return anything": (
        "não deve retornar nada | should not return anything"
    ),
    "should throw BadRequestException when nickname is empty": (
        "deve lançar BadRequestException quando o nickname está vazio | "
        "should throw BadRequestException when nickname is empty"
    ),
    "should throw BadRequestException when nickname is undefined": (
        "deve lançar BadRequestException quando o nickname é undefined | "
        "should throw BadRequestException when nickname is undefined"
    ),
    "should return scan and sources when scan exists": (
        "deve retornar scan e sources quando o scan existe | "
        "should return scan and sources when scan exists"
    ),
    "should throw NotFoundException when scan does not exist": (
        "deve lançar NotFoundException quando o scan não existe | "
        "should throw NotFoundException when scan does not exist"
    ),

    ###########################
    # sources.processor.spec.ts
    ###########################
    "should skip processing when lock is not acquired": (
        "deve pular o processamento quando o lock não é adquirido | "
        "should skip processing when lock is not acquired"
    ),
    "should skip when source is deactivated": (
        "deve pular quando a source está desativada | "
        "should skip when source is deactivated"
    ),
    "should skip when existing source scan is already pending": (
        "deve pular quando o source scan existente já está pendente | "
        "should skip when existing source scan is already pending"
    ),
    "should skip when existing source scan has valid cache": (
        "deve pular quando o source scan existente tem cache válido | "
        "should skip when existing source scan has valid cache"
    ),
    "should update to pending and execute scan when cache is invalid": (
        "deve atualizar para pendente e executar scan quando o cache é inválido | "
        "should update to pending and execute scan when cache is invalid"
    ),
    "should create pending and execute scan when no existing source scan": (
        "deve criar pendente e executar scan quando não há source scan existente | "
        "should create pending and execute scan when no existing source scan"
    ),
    "should call updateToCompleted with found=true when scan succeeds with found": (
        "deve chamar updateToCompleted com found=true quando o scan obtém sucesso com found | "
        "should call updateToCompleted with found=true when scan succeeds with found"
    ),
    "should call updateToCompleted with found=false when scan returns not_found": (
        "deve chamar updateToCompleted com found=false quando o scan retorna not_found | "
        "should call updateToCompleted with found=false when scan returns not_found"
    ),
    "should call updateToFailed when executeScan throws": (
        "deve chamar updateToFailed quando executeScan lança erro | "
        "should call updateToFailed when executeScan throws"
    ),
    "should complete scan when all sources are finished": (
        "deve completar o scan quando todas as sources estão finalizadas | "
        "should complete scan when all sources are finished"
    ),
    "should not complete scan when some sources are still pending": (
        "não deve completar o scan quando algumas sources ainda estão pendentes | "
        "should not complete scan when some sources are still pending"
    ),

    ###########################
    # scan.service.spec.ts
    ###########################
    "should create pending scan and enqueue sources when scan does not exist": (
        "deve criar scan pendente e enfileirar sources quando o scan não existe | "
        "should create pending scan and enqueue sources when scan does not exist"
    ),
    "should skip creating scan when scan already exists with pending status": (
        "deve pular a criação do scan quando o scan já existe com status pendente | "
        "should skip creating scan when scan already exists with pending status"
    ),
    "should update existing scan to pending when scan exists with non-pending status": (
        "deve atualizar o scan existente para pendente quando o scan existe com status não pendente | "
        "should update existing scan to pending when scan exists with non-pending status"
    ),
    "should update to failed when an error occurs during the scan": (
        "deve atualizar para failed quando um erro ocorre durante o scan | "
        "should update to failed when an error occurs during the scan"
    ),
    "should not proceed when lock is not acquired": (
        "não deve prosseguir quando o lock não é adquirido | "
        "should not proceed when lock is not acquired"
    ),
    "should handle errors from updateToFailed gracefully": (
        "deve lidar com erros do updateToFailed de forma graciosa | "
        "should handle errors from updateToFailed gracefully"
    ),
    "should return null when scan does not exist": (
        "deve retornar null quando o scan não existe | "
        "should return null when scan does not exist"
    ),

    ###########################
    # lock.service.spec.ts
    ###########################
    "should execute callback when lock is acquired": (
        "deve executar o callback quando o lock é adquirido | "
        "should execute callback when lock is acquired"
    ),
    "should release the lock after callback": (
        "deve liberar o lock após o callback | "
        "should release the lock after callback"
    ),
    "should release the lock even if callback throws": (
        "deve liberar o lock mesmo se o callback lançar erro | "
        "should release the lock even if callback throws"
    ),
    "should return callback result": (
        "deve retornar o resultado do callback | "
        "should return callback result"
    ),
    "should return true when the lock is acquired": (
        "deve retornar true quando o lock é adquirido | "
        "should return true when the lock is acquired"
    ),
    "should return false when the lock already exists": (
        "deve retornar false quando o lock já existe | "
        "should return false when the lock already exists"
    ),
    "should release the lock": (
        "deve liberar o lock | should release the lock"
    ),

    ###########################
    # scan.repository.spec.ts
    ###########################
    "should update scan status to completed": (
        "deve atualizar o status do scan para completed | "
        "should update scan status to completed"
    ),
    "should save updated scan": (
        "deve salvar o scan atualizado | should save updated scan"
    ),
    "should throw when scan does not exist": (
        "deve lançar erro quando o scan não existe | "
        "should throw when scan does not exist"
    ),
    "should throw when redis.set returns null": (
        "deve lançar erro quando redis.set retorna null | "
        "should throw when redis.set returns null"
    ),
    "should return scan": (
        "deve retornar o scan | should return scan"
    ),
    "should return null when scan does not exist": (
        "deve retornar null quando o scan não existe | "
        "should return null when scan does not exist"
    ),
    "should update scan status to failed": (
        "deve atualizar o status do scan para failed | "
        "should update scan status to failed"
    ),
    "should update scan status to pending": (
        "deve atualizar o status do scan para pending | "
        "should update scan status to pending"
    ),
    "should create and return scan object pending status.": (
        "deve criar e retornar objeto scan com status pending | "
        "should create and return scan object with pending status"
    ),
    "should create and save with the scan object pending status.": (
        "deve criar e salvar o objeto scan com status pending | "
        "should create and save the scan object with pending status"
    ),
    "should throws an error because redis.set returns null.": (
        "deve lançar um erro porque redis.set retorna null | "
        "should throw an error because redis.set returns null"
    ),

    ###########################
    # sourceScan.repository.spec.ts
    ###########################
    "should return source scan": (
        "deve retornar o source scan | should return source scan"
    ),
    "should return null when source scan does not exist": (
        "deve retornar null quando o source scan não existe | "
        "should return null when source scan does not exist"
    ),
    "should return source scans indexed by source id": (
        "deve retornar source scans indexados por source id | "
        "should return source scans indexed by source id"
    ),
    "should skip missing source scans": (
        "deve pular source scans ausentes | "
        "should skip missing source scans"
    ),
    "should create and return source scan with pending status": (
        "deve criar e retornar source scan com status pending | "
        "should create and return source scan with pending status"
    ),
    "should save source scan with ttl and nx option": (
        "deve salvar source scan com opção ttl e nx | "
        "should save source scan with ttl and nx option"
    ),
    "should throw when redis.set returns null": (
        "deve lançar erro quando redis.set retorna null | "
        "should throw when redis.set returns null"
    ),
    "should update source scan status to found": (
        "deve atualizar o status do source scan para found | "
        "should update source scan status to found"
    ),
    "should update source scan status to not_found": (
        "deve atualizar o status do source scan para not_found | "
        "should update source scan status to not_found"
    ),
    "should save updated source scan": (
        "deve salvar o source scan atualizado | "
        "should save updated source scan"
    ),
    "should throw when source scan does not exist": (
        "deve lançar erro quando o source scan não existe | "
        "should throw when source scan does not exist"
    ),
    "should update source scan status to failed": (
        "deve atualizar o status do source scan para failed | "
        "should update source scan status to failed"
    ),
    "should update source scan status to pending": (
        "deve atualizar o status do source scan para pending | "
        "should update source scan status to pending"
    ),
}

FILES = [
    BASE / "controllers" / "scan.controller.spec.ts",
    BASE / "sources.processor.spec.ts",
    BASE / "services" / "scan.service.spec.ts",
    BASE / "services" / "lock.service.spec.ts",
    BASE / "repositories" / "scan.repository.spec.ts",
    BASE / "repositories" / "sourceScan.repository.spec.ts",
]

def get_indent(line):
    m = re.match(r'^(\s*)', line)
    return m.group(1) if m else ""

def process_file(filepath):
    with open(filepath, "r") as f:
        content = f.read()
    
    lines = content.split("\n")
    new_lines = []
    changes = 0

    for line in lines:
        # Match patterns like: it("should ...")
        m = re.match(r'^(\s*)it\(\s*"([^"]+)"\s*,\s*(.*)', line)
        if m:
            indent = m.group(1)
            english = m.group(2)
            rest = m.group(3)
            if english in MAPPING:
                new_text = f'{indent}it("{MAPPING[english]}", {rest}'
                new_lines.append(new_text)
                changes += 1
                print(f"  [{filepath.name}] Changed: '{english[:50]}...'")
            else:
                new_lines.append(line)
                print(f"  [{filepath.name}] NOT FOUND: '{english}'")
        else:
            new_lines.append(line)
    
    if changes > 0:
        with open(filepath, "w") as f:
            f.write("\n".join(new_lines))
    
    return changes

total = 0
for fp in FILES:
    if fp.exists():
        print(f"\nProcessing {fp}...")
        c = process_file(fp)
        total += c
        print(f"  -> {c} changes")
    else:
        print(f"\nNOT FOUND: {fp}")

print(f"\nTotal changes: {total}")
