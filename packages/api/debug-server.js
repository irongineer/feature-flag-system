const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

app.post('/api/evaluate', (req, res) => {
  console.log('Request body:', req.body);
  res.json({ 
    enabled: false, 
    flagKey: req.body.flagKey, 
    tenantId: req.body.tenantId,
    source: 'debug'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`Debug server running on port ${PORT}`);
});