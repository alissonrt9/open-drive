OPEN DRIVE — Modelos 3D Reais (.glb)
====================================

Coloque os arquivos .glb dos carros reais nesta pasta (`assets/cars/`) usando
exatamente os nomes abaixo para que o jogo os carregue automaticamente em 3D:

  1. bmw-m3-g80.glb          (BMW M3 Competition G80)
  2. nissan-gtr-r35.glb      (Nissan GT-R R35)
  3. porsche-911-992.glb     (Porsche 911 Carrera S 992)
  4. lamborghini-huracan.glb (Lamborghini Huracán EVO)
  5. ferrari-488-gtb.glb     (Ferrari 488 GTB)
  6. toyota-supra-a90.glb    (Toyota GR Supra A90)
  7. ford-mustang-gt.glb     (Ford Mustang GT)

Notas técnicas:
- O carregador (`THREE.GLTFLoader`) normaliza automaticamente a escala do modelo
  para as dimensões reais de cada veículo (comprimento, altura e largura).
- Malhas cujos nomes contenham "wheel", "tire", "tyre", "rim", "roda" ou "pneu"
  são identificadas automaticamente para rotação e esterçamento das rodas dianteiras.
- Caso um arquivo .glb ainda não esteja presente, o jogo utiliza automaticamente
  o modelo procedural esculpido de alta definição correspondente.
