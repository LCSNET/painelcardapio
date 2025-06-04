// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Simulação de Banco de Dados (Arrays em Memória) ---
let pizzasDB = [
    { id: "1", nome: "Calabresa Tradicional", descricao: "Molho, mussarela, calabresa e cebola.", preco: 30.00, imagem: "/uploads/placeholder-pizza.png" },
    { id: "2", nome: "Marguerita Especial", descricao: "Molho, mussarela, tomate e manjericão.", preco: 28.00, imagem: "/uploads/placeholder-pizza.png" }
];
let bebidasDB = [
    { id: "101", nome: "Coca-Cola 2L", descricao: "Refrigerante", preco: 10.00, imagem: "/uploads/placeholder-bebida.png" },
    { id: "102", nome: "Suco de Laranja 1L", descricao: "Natural", preco: 8.00, imagem: "/uploads/placeholder-bebida.png" }
];
let nextPizzaId = 3;
let nextBebidaId = 103;

// --- Configuração do Multer para Upload de Imagens ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)){
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

// --- Funções Auxiliares para Simular o Banco de Dados ---
const getCollection = (type) => type === 'pizza' ? pizzasDB : bebidasDB;
const setCollection = (type, data) => {
    if (type === 'pizza') pizzasDB = data;
    else bebidasDB = data;
};
const getNextId = (type) => type === 'pizza' ? nextPizzaId++ : nextBebidaId++;

// --- Rotas da API ---

// LISTAR (GET)
app.get('/api/:type', (req, res) => {
    const { type } = req.params;
    if (type !== 'pizzas' && type !== 'bebidas') {
        return res.status(400).json({ message: 'Tipo de produto inválido.' });
    }
    res.json(getCollection(type.slice(0, -1)));
});

// ADICIONAR (POST)
app.post('/api/:type', upload.single('imagemFile'), (req, res) => {
    const { type } = req.params;
    const productTypeKey = type.slice(0, -1);
    if (productTypeKey !== 'pizza' && productTypeKey !== 'bebida') {
        return res.status(400).json({ message: 'Tipo de produto inválido.' });
    }
    
    const { nome, descricao, preco } = req.body;
    if (!nome || !preco) {
        return res.status(400).json({ message: 'Nome e preço são obrigatórios.' });
    }
    if (!req.file && !id) { // Se é novo e não tem arquivo
         return res.status(400).json({ message: 'Imagem é obrigatória para novos produtos.' });
    }

    const newProduct = {
        id: String(getNextId(productTypeKey)),
        nome,
        descricao,
        preco: parseFloat(preco),
        imagem: req.file ? `/uploads/${req.file.filename}` : (req.body.imagem || '/uploads/placeholder-default.png')
    };

    const collection = getCollection(productTypeKey);
    collection.push(newProduct);
    setCollection(productTypeKey, collection);
    res.status(201).json(newProduct);
});

// ATUALIZAR (PUT)
app.put('/api/:type/:id', upload.single('imagemFile'), (req, res) => {
    const { type, id } = req.params;
    const productTypeKey = type.slice(0, -1);

    if (productTypeKey !== 'pizza' && productTypeKey !== 'bebida') {
        return res.status(400).json({ message: 'Tipo de produto inválido.' });
    }

    const { nome, descricao, preco } = req.body;
    let collection = getCollection(productTypeKey);
    const productIndex = collection.findIndex(p => p.id === id);

    if (productIndex === -1) {
        return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    const updatedProduct = { ...collection[productIndex] };
    if (nome) updatedProduct.nome = nome;
    if (descricao !== undefined) updatedProduct.descricao = descricao;
    if (preco) updatedProduct.preco = parseFloat(preco);
    
    if (req.file) {
        const oldImage = collection[productIndex].imagem;
        if (oldImage && oldImage.startsWith('/uploads/') && !oldImage.includes('placeholder')) {
            const oldImagePath = path.join(__dirname, oldImage);
            if (fs.existsSync(oldImagePath)) {
                try { fs.unlinkSync(oldImagePath); } catch(err){ console.error("Erro ao deletar imagem antiga:", err)}
            }
        }
        updatedProduct.imagem = `/uploads/${req.file.filename}`;
    } else if (req.body.imagem) { 
        updatedProduct.imagem = req.body.imagem;
    }

    collection[productIndex] = updatedProduct;
    setCollection(productTypeKey, collection);
    res.json(updatedProduct);
});

// DELETAR (DELETE)
app.delete('/api/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const productTypeKey = type.slice(0, -1);
    if (productTypeKey !== 'pizza' && productTypeKey !== 'bebida') {
        return res.status(400).json({ message: 'Tipo de produto inválido.' });
    }

    let collection = getCollection(productTypeKey);
    const productIndex = collection.findIndex(p => p.id === id);

    if (productIndex === -1) {
        return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    const productToDelete = collection[productIndex];
    if (productToDelete.imagem && productToDelete.imagem.startsWith('/uploads/') && !productToDelete.imagem.includes('placeholder')) {
        const imagePath = path.join(__dirname, productToDelete.imagem);
        if (fs.existsSync(imagePath)) {
             try { fs.unlinkSync(imagePath); } catch(err){ console.error("Erro ao deletar imagem:", err)}
        }
    }

    collection.splice(productIndex, 1);
    setCollection(productTypeKey, collection);
    res.status(200).json({ message: 'Produto deletado com sucesso.' });
});


app.listen(PORT, () => {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
    console.log('Usando banco de dados em memória (arrays). Dados serão perdidos ao reiniciar o servidor.');
    if (!fs.existsSync(path.join(UPLOADS_DIR, 'placeholder-pizza.png')) || !fs.existsSync(path.join(UPLOADS_DIR, 'placeholder-bebida.png'))) {
        console.warn('AVISO: Crie as imagens placeholder "placeholder-pizza.png" e "placeholder-bebida.png" na pasta "backend/uploads/" para os dados iniciais.');
    }
});